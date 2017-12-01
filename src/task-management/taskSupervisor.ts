import {isNullOrUndefined} from "util";

const debug = require("debug")("pipeline:worker-api:task-supervisor");

import {RemotePersistentStorageManager} from "../data-access/remote/databaseConnector";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {localTaskManager} from "./localTaskManager";
import {CompletionStatusCode, ExecutionStatusCode, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {Workers} from "../data-model/worker";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {synchronizeTaskExecutions} from "../data-access/synchronize";
import {updateStatisticsForTaskId} from "../data-model/taskStatistics";

export enum QueueType {
    Local = 0,
    Cluster = 1
}

/***
 * These are mapped from string values return from PM2 for local management and LSF for cluster management.
 ***/
export enum ExecutionStatus {
    Undefined = -1,
    Unknown = 0,
    Pending = 1,
    Started = 2,
    Online = 3,
    Restarted = 4,
    RestartOverLimit = 5,
    Stopping = 6,
    Stopped = 7,
    Exited = 8,
    Deleted = 9
}

export interface IProcessId {
    id: number;
    status: ExecutionStatus;
    exitCode: number;
}

export interface IExecutionStatistics {
    cpuPercent: number;
    cpuTime: number;
    memoryGB: number;
}

export interface ITaskSupervisor {
    startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;
    stopTask(taskExecutionId: string): Promise<ITaskExecution>;
}

export interface ITaskUpdateSource {
    TaskUpdateDelegate: ITaskUpdateDelegate;
}

export interface ITaskUpdateDelegate {
    update(taskExecution: ITaskExecution, processInfo: IProcessId, stats: IExecutionStatistics);
}

export class TaskSupervisor implements ITaskSupervisor, ITaskUpdateDelegate {
    public static Instance = new TaskSupervisor();

    private _remotePersistentStorageManager: RemotePersistentStorageManager = RemotePersistentStorageManager.Instance();

    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    public constructor() {
        localTaskManager.TaskUpdateDelegate = this;

        setTimeout(async () => {
            await this.synchronizeUnsuccessfulTasks();
        }, 0)
    }

    public async startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>) {
        const taskDefinition: ITaskDefinition = await this._remotePersistentStorageManager.TaskDefinitions.findById(taskDefinitionId);

        debug(`starting task ${taskDefinition.name} for pipeline ${pipelineStageId}`);

        let customArgs = [];

        if (taskDefinition.args) {
            customArgs = taskDefinition.args.split(/[\s+]/).filter(Boolean);
        }

        const worker = await Workers.Instance().worker();

        const isClusterProxy = worker.is_cluster_proxy ? "1" : "0";

        const combinedArgs = scriptArgs.concat(taskDefinition.expected_exit_code.toString()).concat([isClusterProxy]).concat(customArgs);

        const taskExecution = await this._localStorageManager.TaskExecutions.createTask(worker.id, worker.is_cluster_proxy ? QueueType.Cluster : QueueType.Local, taskDefinition, pipelineStageId, tileId, combinedArgs);

        taskExecution.resolved_script = await taskDefinition.getFullScriptPath();

        taskExecution.resolved_interpreter = taskDefinition.interpreter;

        taskExecution.started_at = new Date();

        try {
            taskExecution.execution_status_code = ExecutionStatusCode.Running;

            await taskExecution.save();

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.

            // debug(opts);

            if (worker.is_cluster_proxy) {
                await localTaskManager._startTask(taskExecution, taskDefinition, combinedArgs);
            } else {
                await localTaskManager._startTask(taskExecution, taskDefinition, combinedArgs);
            }
        } catch (err) {
            debug(err);

            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatusCode.Completed;
            taskExecution.completion_status_code = CompletionStatusCode.Error;

            await taskExecution.save();
        }

        return this._localStorageManager.TaskExecutions.findById(taskExecution.id);
    }

    public async stopTask(taskExecutionId: string): Promise<ITaskExecution> {
        try {
            let taskExecution: ITaskExecution = await this._localStorageManager.TaskExecutions.findById(taskExecutionId);

            if (taskExecution.completion_status_code < CompletionStatusCode.Cancel) {
                taskExecution.execution_status_code = ExecutionStatusCode.Orphaned;
                // Assume orphaned unless the process manager sends a completion event from stop() below.
                taskExecution.completion_status_code = CompletionStatusCode.Cancel;

                await taskExecution.save();
            }

            if (taskExecution.queue_type === QueueType.Local) {
                await localTaskManager._stopTask(taskExecutionId);
            } else {
                await localTaskManager._stopTask(taskExecutionId);
            }

            return this._localStorageManager.TaskExecutions.findById(taskExecutionId);
        } catch (err) {
            // Null error means error in ProcessManager.stop() and already reported.
            if (err !== null) {
                debug(err);
            }
            return null;
        }
    }

    public async update(taskExecution: ITaskExecution, processInfo: IProcessId, stats: IExecutionStatistics) {
        await _update(taskExecution, processInfo, stats);
    }

    private async synchronizeUnsuccessfulTasks() {
        try {
            const worker = await Workers.Instance().worker();

            if (!isNullOrUndefined(worker)) {
                await synchronizeTaskExecutions(worker.id, CompletionStatusCode.Error);
                await synchronizeTaskExecutions(worker.id, CompletionStatusCode.Cancel);
                await synchronizeTaskExecutions(worker.id, CompletionStatusCode.Resubmitted);
            }

            setTimeout(async () => await this.synchronizeUnsuccessfulTasks(), 15000);
        } catch (err) {
            debug(err);
        }
    }
}

async function _update(taskExecution: ITaskExecution, processInfo: IProcessId, stats: IExecutionStatistics) {
    if (taskExecution == null || processInfo == null) {
        debug(`skipping update for null task execution (${taskExecution == null}) or process info (${processInfo == null})`);
        return;
    }

    if (stats) {
        if (!isNullOrUndefined(stats.memoryGB) && (stats.memoryGB > taskExecution.max_memory || isNaN(taskExecution.max_memory))) {
            taskExecution.max_memory = stats.memoryGB;
        }

        if (!isNullOrUndefined(stats.cpuPercent) && (stats.cpuPercent > taskExecution.max_cpu || isNaN(taskExecution.max_cpu))) {
            taskExecution.max_cpu = stats.cpuPercent;
        }
    }

    // Have a real status from the process manager (e.g, PM2).
    if (processInfo.status > taskExecution.last_process_status_code) {
        taskExecution.last_process_status_code = processInfo.status;
    }

    // Stop/Exit/Delete
    if (processInfo.status >= ExecutionStatus.Stopped) {
        if (taskExecution.completed_at == null) {
            // debug(`marking complete for task execution ${taskExecution.id}`);

            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatusCode.Completed;

            if (taskExecution.completion_status_code < CompletionStatusCode.Cancel) {
                // Do not have control on how PM2 fires events.  Can't assume we didn't get an exit code already.
                taskExecution.completion_status_code = CompletionStatusCode.Unknown;
            }
        }
    }

    // PM2 is not uniform on when its "process object" includes an exit code.  Handle outside of the formal
    // completion code above.
    if (processInfo.exitCode != null) {
        // May already be set if cancelled.
        if (taskExecution.completion_status_code < CompletionStatusCode.Cancel) {
            taskExecution.completion_status_code = (processInfo.exitCode === taskExecution.expected_exit_code) ? CompletionStatusCode.Success : CompletionStatusCode.Error;
        }

        if (taskExecution.exit_code === null) {
            taskExecution.exit_code = processInfo.exitCode;

            updateStatisticsForTaskId(taskExecution);
        }
    }

    await taskExecution.save();
}
