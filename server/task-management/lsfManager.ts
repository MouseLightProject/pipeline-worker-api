import {spawn} from "child_process";
import * as _ from "lodash";

const debug = require("debug")("pipeline:worker-api:lsf-manager");

import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionResult, ExecutionStatus, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {IJobUpdate, ITaskUpdateDelegate, ITaskUpdateSource} from "./taskSupervisor";
import {updateJobInfo} from "./lsf";

export class LSFTaskManager implements ITaskUpdateSource {
    public static Instance = new LSFTaskManager();

    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    private _taskUpdateDelegate: ITaskUpdateDelegate;

    public constructor() {
        // Periodically poll cluster job status.
        setTimeout(async () => {
            await this.refreshAllJobs();
        }, 0);
    }

    public get TaskUpdateDelegate(): ITaskUpdateDelegate {
        return this._taskUpdateDelegate;
    }

    public set TaskUpdateDelegate(delegate: ITaskUpdateDelegate) {
        this._taskUpdateDelegate = delegate;
    }

    private async refreshAllJobs() {
        try {
            await this.pollClusterJobStatus();

            setTimeout(() => this.refreshAllJobs(), 30 * 1000);
        } catch (err) {
            debug(err);
        }
    }

    private async pollClusterJobStatus() {
        const jobInfo: IJobUpdate[] = await updateJobInfo();

        debug(`received ${jobInfo.length} job status updates`);

        if (jobInfo && jobInfo.length > 0) {
            const map = new Map<number, IJobUpdate>();

            jobInfo.map((j) => {
                map.set(j.id, j);
            });

            const running: ITaskExecution[] = this._localStorageManager.TaskExecutions.findRunning();

            const toUpdate: ITaskExecution[] = _.intersectionWith(running, jobInfo, (r: ITaskExecution, j: IJobUpdate) => {
                return r.job_id === j.id;
            });

            debug(`matched ${toUpdate.length} known jobs for update`);

            if (this.TaskUpdateDelegate) {
                await Promise.all(toUpdate.map(async (o) => {

                    const processInfo = map.get(o.job_id);

                    if (processInfo) {
                        await this.TaskUpdateDelegate.update(o, {
                            id: processInfo.id,
                            status: processInfo.status,
                            exitCode: processInfo.exitCode,
                            statistics: null
                        });
                    }
                }));
            }

            const zombie: ITaskExecution[] = _.differenceWith(running, jobInfo, (r: ITaskExecution, j: IJobUpdate) => {
                return r.job_id === j.id;
            });

            debug(`matched ${zombie.length} zombie jobs for removal`);

            await Promise.all(zombie.map(async (o) => {
                await this.TaskUpdateDelegate.updateZombie(o);
            }));
        }
    }

    public async startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition, args: string[]) {
        const programArgs = [taskExecution.resolved_script].concat(args).join(" ");
        debug(programArgs);

        const clusterArgs = ["-n", "3", "-J", `ml-dg-${taskExecution.tile_id}`, "-cwd", `-R"select[broadwell]"`, "-g", `/mouselight/pipeline/${taskExecution.worker_id}`, `'${programArgs}'`];
        console.log(clusterArgs);

        const submit = spawn(`bsub`, clusterArgs);

        submit.on("close", (code) => {
            if (code > 0) {
                debug(`submitted task id ${taskExecution.id} and received job id (exit code) ${code}`);
                taskExecution.job_id = code;
            } else {
                taskExecution.completed_at = new Date();
                taskExecution.execution_status_code = ExecutionStatus.Completed;
                taskExecution.completion_status_code = CompletionResult.Error;
            }

            taskExecution.save();
        });
    }

    public async stopTask(taskExecutionId: string) {
        // TODO bkill
    }
}
