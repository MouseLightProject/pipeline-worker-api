import {isNullOrUndefined} from "util";

const debug = require("debug")("pipeline:worker-api:task-supervisor");

import {RemotePersistentStorageManager} from "../data-access/remote/databaseConnector";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {localTaskManager} from "./localTaskManager";
import {CompletionResult, ExecutionStatus, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {Workers} from "../data-model/worker";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {synchronizeTaskExecutions} from "../data-access/synchronize";
import {updateStatisticsForTaskId} from "../data-model/taskStatistics";
import {LSFTaskManager} from "./lsfManager";
import {existsSync, mkdirSync} from "fs";
import * as path from "path";

const PIPELINE_INPUT_INDEX = 5;
const TILE_NAME_INDEX = 5;
const LOG_PATH_INDEX = 6;

export enum QueueType {
    Local = 0,
    Cluster = 1
}

/***
 * These are mapped from string values return from PM2 for local management and LSF for cluster management.
 ***/
export enum JobStatus {
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

export interface IJobStatistics {
    cpuPercent: number;
    cpuTime: number;
    memoryGB: number;
}

export interface IJobUpdate {
    id: number;
    status: JobStatus;
    exitCode: number;
    statistics: IJobStatistics;
}

export interface ITaskSupervisor {
    startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;
    stopTask(taskExecutionId: string): Promise<ITaskExecution>;
}

export interface ITaskUpdateSource {
    TaskUpdateDelegate: ITaskUpdateDelegate;
}

export interface ITaskUpdateDelegate {
    updateZombie(taskExecution: ITaskExecution);
    update(taskExecution: ITaskExecution, processInfo: IJobUpdate);
}

export interface ITaskManager {
    startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition): void;
    stopTask(taskExecutionId: string): void;
}

export class TaskSupervisor implements ITaskSupervisor, ITaskUpdateDelegate {
    public static Instance = new TaskSupervisor();

    private _remotePersistentStorageManager: RemotePersistentStorageManager = RemotePersistentStorageManager.Instance();

    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    public constructor() {
        localTaskManager.TaskUpdateDelegate = this;

        LSFTaskManager.Instance.TaskUpdateDelegate = this;

        setTimeout(async () => {
            await this.synchronizeUnsuccessfulTasks();
        }, 0)
    }

    public async startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>) {
        const taskDefinition: ITaskDefinition = await this._remotePersistentStorageManager.TaskDefinitions.findById(taskDefinitionId);

        debug(`starting task ${taskDefinition.name} for pipeline ${pipelineStageId}`);

        const worker = await Workers.Instance().worker();

        const taskExecution = await this._localStorageManager.TaskExecutions.createTask(worker.id, worker.is_cluster_proxy ? QueueType.Cluster : QueueType.Local, taskDefinition, pipelineStageId, tileId);

        let userScriptArgs = taskDefinition.script_args ? taskDefinition.script_args.split(/[\s+]/).filter(Boolean) : [];

        taskExecution.resolved_script_arg_array = scriptArgs.concat(taskDefinition.expected_exit_code.toString()).concat(worker.id).concat([worker.is_cluster_proxy ? "1" : "0"]).concat(userScriptArgs);

        taskExecution.resolved_cluster_arg_array = taskDefinition.cluster_args ? taskDefinition.cluster_args.split(/[\s+]/).filter(Boolean) : [];
        taskExecution.resolved_cluster_args = taskExecution.resolved_cluster_arg_array.join(", ");

        taskExecution.resolved_script = await taskDefinition.getFullScriptPath();

        taskExecution.resolved_interpreter = taskDefinition.interpreter;

        if (taskExecution.resolved_script_arg_array.length > LOG_PATH_INDEX) {
            const logBase = taskExecution.resolved_script_arg_array[LOG_PATH_INDEX];

            try {
                const logDirectory = path.join(logBase, taskExecution.tile_id, ".log");

                if (!existsSync(logDirectory)) {
                    mkdirSync(logDirectory)
                }

                taskExecution.resolved_log_path = path.join(logDirectory, `${taskDefinition.log_prefix}-${taskExecution.resolved_script_arg_array[TILE_NAME_INDEX]}`);
            } catch (err) {
                debug("failed to create log directory");
                debug(err);
            }
        }

        taskExecution.resolved_log_path = taskExecution.resolved_log_path || "/tmp";

        if (taskExecution.resolved_script_arg_array.length > LOG_PATH_INDEX) {
            taskExecution.resolved_script_arg_array[LOG_PATH_INDEX] = taskExecution.resolved_log_path;
            taskExecution.resolved_script_args = taskExecution.resolved_script_arg_array.join(", ");
        }

        taskExecution.started_at = new Date();

        try {
            taskExecution.execution_status_code = ExecutionStatus.Running;

            await taskExecution.save();

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.

            // debug(opts);

            if (worker.is_cluster_proxy) {
                await  LSFTaskManager.Instance.startTask(taskExecution, taskDefinition);
            } else {
                await localTaskManager.startTask(taskExecution, taskDefinition);
            }
        } catch (err) {
            debug(err);

            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatus.Completed;
            taskExecution.completion_status_code = CompletionResult.Error;

            await taskExecution.save();
        }

        return this._localStorageManager.TaskExecutions.findById(taskExecution.id);
    }

    public async stopTask(taskExecutionId: string, isZombie = false): Promise<ITaskExecution> {
        try {
            let taskExecution: ITaskExecution = await this._localStorageManager.TaskExecutions.findById(taskExecutionId);

            if (taskExecution.completion_status_code < CompletionResult.Cancel) {
                taskExecution.execution_status_code = ExecutionStatus.Zombie;
                // Assume orphaned unless the process manager sends a completion event from stop() below.
                taskExecution.completion_status_code = CompletionResult.Cancel;

                await taskExecution.save();
            }

            if (!isZombie) {
                if (taskExecution.queue_type === QueueType.Local) {
                    await localTaskManager.stopTask(taskExecutionId);
                } else {
                    await LSFTaskManager.Instance.stopTask(taskExecutionId);
                }
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

    public async update(taskExecution: ITaskExecution, processInfo: IJobUpdate) {
        await _update(taskExecution, processInfo);
    }

    public async updateZombie(taskExecution: ITaskExecution) {
        await this.stopTask(taskExecution.id, true);
    }

    private async synchronizeUnsuccessfulTasks() {
        try {
            const worker = await Workers.Instance().worker();

            if (!isNullOrUndefined(worker)) {
                await synchronizeTaskExecutions(worker.id, CompletionResult.Error);
                await synchronizeTaskExecutions(worker.id, CompletionResult.Cancel);
                await synchronizeTaskExecutions(worker.id, CompletionResult.Resubmitted);
            }

            setTimeout(async () => await this.synchronizeUnsuccessfulTasks(), 15000);
        } catch (err) {
            debug(err);
        }
    }
}

async function _update(taskExecution: ITaskExecution, jobUpdate: IJobUpdate) {
    if (taskExecution == null || jobUpdate == null) {
        debug(`skipping update for null task execution (${taskExecution == null}) or process info (${jobUpdate == null})`);
        return;
    }

    if (!isNullOrUndefined(jobUpdate.statistics)) {
        if (!isNullOrUndefined(jobUpdate.statistics.memoryGB) && (jobUpdate.statistics.memoryGB > taskExecution.max_memory || isNaN(taskExecution.max_memory))) {
            taskExecution.max_memory = jobUpdate.statistics.memoryGB;
        }

        if (!isNullOrUndefined(jobUpdate.statistics.cpuPercent) && (jobUpdate.statistics.cpuPercent > taskExecution.max_cpu || isNaN(taskExecution.max_cpu))) {
            taskExecution.max_cpu = jobUpdate.statistics.cpuPercent;
        }
    }

    if (!isNullOrUndefined(jobUpdate.status)) {
        // Have a real status from the process manager (e.g, PM2).
        if (jobUpdate.status > taskExecution.last_process_status_code) {
            taskExecution.last_process_status_code = jobUpdate.status;
        }

        // Stop/Exit/Delete
        if (jobUpdate.status >= JobStatus.Stopped) {
            if (taskExecution.completed_at == null) {
                // debug(`marking complete for task execution ${taskExecution.id}`);

                taskExecution.completed_at = new Date();
                taskExecution.execution_status_code = ExecutionStatus.Completed;

                if (taskExecution.completion_status_code < CompletionResult.Cancel) {
                    // Do not have control on how PM2 fires events.  Can't assume we didn't get an exit code already.
                    taskExecution.completion_status_code = CompletionResult.Unknown;
                }
            }
        }

        if (taskExecution.queue_type === QueueType.Local) {
            // Exit code may arrive separately from status change of done/exit.
            if (!isNullOrUndefined(jobUpdate.exitCode)) {
                // May already be set if cancelled.
                if (taskExecution.completion_status_code < CompletionResult.Cancel) {
                    taskExecution.completion_status_code = (jobUpdate.exitCode === taskExecution.expected_exit_code) ? CompletionResult.Success : CompletionResult.Error;
                }

                if (taskExecution.exit_code === null) {
                    taskExecution.exit_code = jobUpdate.exitCode;

                    updateStatisticsForTaskId(taskExecution);
                }
            }
        } else {
            debug(`checking completion for ${taskExecution.id}`);

            if (taskExecution.completion_status_code < CompletionResult.Cancel) {
                if (jobUpdate.status === JobStatus.Stopped) {
                    taskExecution.completion_status_code = CompletionResult.Success;
                } else if (jobUpdate.status === JobStatus.Exited) {
                    taskExecution.completion_status_code = CompletionResult.Error;
                }

                if (!isNullOrUndefined(jobUpdate.exitCode) && isNullOrUndefined(taskExecution.exit_code)) {
                    taskExecution.exit_code = jobUpdate.exitCode;

                }

                if (taskExecution.completion_status_code >= CompletionResult.Success) {
                    updateStatisticsForTaskId(taskExecution);
                }
            }
        }
    }

    await taskExecution.save();
}
