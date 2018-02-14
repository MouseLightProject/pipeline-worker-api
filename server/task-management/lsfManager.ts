import {spawn} from "child_process";
import * as _ from "lodash";
import * as fs from "fs";
import * as moment from "moment";

const debug = require("debug")("pipeline:worker-api:lsf-manager");

import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionResult, ExecutionStatus, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {IJobUpdate, ITaskManager, ITaskUpdateDelegate, ITaskUpdateSource, JobStatus, QueueType} from "./taskSupervisor";
import {updateJobInfo} from "./lsf";

export class LSFTaskManager implements ITaskUpdateSource, ITaskManager {
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
        } catch (err) {
            debug(err);
        }

        setTimeout(() => this.refreshAllJobs(), 30 * 1000);
    }

    private async pollClusterJobStatus() {
        const running: ITaskExecution[] = (await this._localStorageManager.TaskExecutions.findRunning()).filter(z => z.queue_type === QueueType.Cluster);

        if (running.length === 0) {
            debug("No running jobs - skipping cluster status check.");
            return;
        }

        const ids = running.map(t => t.job_id).filter(j => j > 0).map(j => j.toString());

        const jobInfo: IJobUpdate[] = await updateJobInfo(ids);

        debug(`received ${jobInfo.length} job status updates`);

        if (jobInfo.length > 0) {
            const map = new Map<number, IJobUpdate>();

            jobInfo.map((j) => {
                map.set(j.id, j);
            });

            debug(`found ${running.length} running jobs`);

            const toUpdate: ITaskExecution[] = _.intersectionWith(running, jobInfo, (r: ITaskExecution, j: IJobUpdate) => {
                return r.job_id === j.id;
            });

            debug(`matched ${toUpdate.length} known jobs for update`);

            if (this.TaskUpdateDelegate) {
                await Promise.all(toUpdate.map(async (o) => {

                    const processInfo = map.get(o.job_id);

                    if (processInfo) {
                        if (processInfo.status === JobStatus.Stopped || processInfo.status === JobStatus.Exited) {
                            await this.TaskUpdateDelegate.update(o, {
                                id: processInfo.id,
                                status: processInfo.status,
                                exitCode: processInfo.exitCode,
                                statistics: null
                            });
                        }
                    }
                }));
            }
        }

        const zombie: ITaskExecution[] = _.differenceWith(running, jobInfo, (r: ITaskExecution, j: IJobUpdate) => {
            return r.job_id === j.id;
        });

        debug(`matched ${zombie.length} zombie jobs for removal`);

        await Promise.all(zombie.filter(z => z.queue_type === QueueType.Cluster).map(async (o) => {
            // Only after 15 minutes in case there is any delay between submission and when the job is first
            // available in polling.
            if (Date.now().valueOf() - o.started_at.valueOf() > 15 * 60 * 1000) {
                await this.TaskUpdateDelegate.updateZombie(o);
            }
        }));

        const longRunning = running.map(r => moment.duration(Date.now().valueOf() - r.started_at.valueOf())).filter(d => d.asSeconds() > 60).sort((a, b) => b.asMilliseconds() - a.asMilliseconds());

        if (longRunning.length > 0) {
            debug(`${longRunning.length} cluster tasks have been running longer than 1 minute`);
            debug(`\tlongest ${longRunning[0].humanize()}`);
            if (longRunning.length > 1) {
                debug(`\tshortest ${longRunning[longRunning.length - 1].humanize()}`);
            }
        }
    }

    public startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition) {
        const programArgs = [taskExecution.resolved_script].concat(taskExecution.resolved_script_arg_array).join(" ");

        const requiredBsubArgs = ["-J", `ml-dg-${taskExecution.tile_id}`, "-g", `/mouselight/pipeline/${taskExecution.worker_id}`, "-oo", `${taskExecution.resolved_log_path + ".cluster.out.log"}`, "-eo", `${taskExecution.resolved_log_path + ".cluster.err.log"}`];

        const clusterArgs = taskExecution.resolved_cluster_arg_array.join(" ").replace(/"/g, `\\"`).replace(/\(/g, `\\(`).replace(/\)/g, `\\)`);

        // const clusterArgs = taskExecution.resolved_cluster_arg_array.join(" ");

        // console.log(clusterArgs);

        const clusterCommand = ["bsub"].concat([clusterArgs]).concat(requiredBsubArgs).concat([, `'${programArgs}'`]).join(" ");

        const commandScript = taskExecution.resolved_log_path + "-cluster-command.sh";

        fs.writeFileSync(commandScript, `#!/usr/bin/env bash\n${clusterCommand}\n`);
        fs.chmodSync(commandScript, 0o775);

        const sshArgs = ["login1", `${commandScript}`];

        try {
            const submit = spawn(`ssh`, sshArgs);

            submit.stdout.on("data", (data: Buffer) => {
                try {
                    const str = data.toString();

                    const r = str.match(/\d+/);

                    taskExecution.job_id = parseInt(r[0]);

                    taskExecution.save();

                    debug(`submitted task id ${taskExecution.id} has job id ${taskExecution.job_id}`);
                } catch (err) {
                    debug(err);

                    taskExecution.completed_at = new Date();
                    taskExecution.execution_status_code = ExecutionStatus.Completed;
                    taskExecution.completion_status_code = CompletionResult.Error;
                }
            });

            submit.stderr.on("data", (data: Buffer) => {
                debug("ssh login1 to submit error:");
                debug(data.toString());

                fs.appendFileSync(taskExecution.resolved_log_path + ".cluster.err.log", "ssh login1 to submit error:");
                fs.appendFileSync(taskExecution.resolved_log_path + ".cluster.err.log", data.toString());
            });

            submit.on("close", (code) => {
                if (code === 0) {
                    debug(`submitted task id ${taskExecution.id}`);
                } else {
                    debug(`failed to submit task id ${taskExecution.id} with exit code ${code}`);

                    taskExecution.completed_at = new Date();
                    taskExecution.execution_status_code = ExecutionStatus.Completed;
                    taskExecution.completion_status_code = CompletionResult.Error;
                }

                taskExecution.save();
            });
        } catch (err) {
            debug(err);

            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatus.Completed;
            taskExecution.completion_status_code = CompletionResult.Error;

            taskExecution.save();
        }
    }

    public async stopTask(taskExecutionId: string) {
        // TODO bkill
    }
}
