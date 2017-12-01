import {spawn} from "child_process";

const debug = require("debug")("pipeline:worker-api:lsf-manager");

import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionStatusCode, ExecutionStatusCode, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {ITaskUpdateDelegate, ITaskUpdateSource} from "./taskSupervisor";
import {updateJobInfo} from "./lsf";

export class LSFTaskManager implements ITaskUpdateSource {
    public static Instance = new LSFTaskManager();

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

            setTimeout(() => this.refreshAllJobs(), 15 * 1000);
        } catch (err) {
            debug(err);
        }
    }

    private async pollClusterJobStatus() {
        const jobInfo = await updateJobInfo();

        console.log(jobInfo);
    }

    public async startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition, args: string[]) {

        const submit = spawn(taskExecution.resolved_script, args);

        submit.on("close", (code) => {
            if (code > 0) {
                taskExecution.job_id = code;
            } else {
                taskExecution.completed_at = new Date();
                taskExecution.execution_status_code = ExecutionStatusCode.Completed;
                taskExecution.completion_status_code = CompletionStatusCode.Error;
            }

            taskExecution.save();
        });
    }

    public async stopTask(taskExecutionId: string) {
        // TODO bkill
    }
}
