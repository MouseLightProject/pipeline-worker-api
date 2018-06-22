import * as fse from "fs-extra";
import {isNullOrUndefined} from "util";

const debug = require("debug")("pipeline:worker-api:task-supervisor");

import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {localTaskManager} from "./localTaskManager";
import {
    CompletionResult, ExecutionStatus, ITaskExecution,
    ITaskExecutionAttributes
} from "../data-model/sequelize/taskExecution";
import {synchronizeTaskExecutions} from "../data-access/synchronize";
import {updateStatisticsForTaskId} from "../data-model/taskStatistics";
import {LSFTaskManager} from "./lsfManager";
import * as path from "path";
import {MainQueue} from "../message-queue/mainQueue";

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
    startTask(remoteTaskExecution: ITaskExecutionAttributes): Promise<ITaskExecution>;
    stopTask(taskExecutionId: string): Promise<ITaskExecutionAttributes>;
}

export interface ITaskUpdateSource {
    TaskUpdateDelegate: ITaskUpdateDelegate;
}

export interface ITaskUpdateDelegate {
    updateZombie(taskExecution: ITaskExecutionAttributes);
    update(taskExecution: ITaskExecutionAttributes, processInfo: IJobUpdate);
}

export interface ITaskManager {
    startTask(taskExecution: ITaskExecutionAttributes): void;
    stopTask(taskExecutionId: string): void;
}

export class TaskSupervisor implements ITaskSupervisor, ITaskUpdateDelegate {
    public static Instance = new TaskSupervisor();

    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    public constructor() {
        localTaskManager.TaskUpdateDelegate = this;

        LSFTaskManager.Instance.TaskUpdateDelegate = this;

        setTimeout(async () => {
            await this.synchronizeUnsuccessfulTasks();
        }, 0)
    }

    public async startTask(remoteTaskExecution: ITaskExecutionAttributes): Promise<ITaskExecution> {
        debug(`starting task ${remoteTaskExecution.task_definition_id} for pipeline ${remoteTaskExecution.pipeline_stage_id}`);

        const worker = await LocalPersistentStorageManager.Instance().Worker;

        const localTaskExecutionInput = Object.assign({}, remoteTaskExecution);

        localTaskExecutionInput.remote_task_execution_id = remoteTaskExecution.id;
        localTaskExecutionInput.id = undefined;

        if (!path.isAbsolute(localTaskExecutionInput.resolved_script)) {
            // This happens if a repository is not used or an absolute path is not used.  The coordinator does not make
            // it absolute based on that remote location.
            localTaskExecutionInput.resolved_script = path.join(process.cwd(), localTaskExecutionInput.resolved_script);
        }

        let taskExecution: ITaskExecution = await this._localStorageManager.TaskExecutions.create(localTaskExecutionInput);

        try {
            fse.ensureDirSync(taskExecution.resolved_output_path);
            fse.chmodSync(taskExecution.resolved_output_path, 0o775);
            // resolved_log_path is really the log prefix i.e., the log path plus the prefix for file names.  There is no
            // extension so node sees this as a directory.
            fse.ensureDirSync(path.resolve(taskExecution.resolved_log_path, ".."));
            debug(`ensured log path at ${path.resolve(taskExecution.resolved_log_path, "..")}`);

            const completeFile = path.join(`${taskExecution.resolved_log_path}-done.txt`);

            try {
                if (fse.existsSync(completeFile)) {
                    fse.unlinkSync(completeFile);
                }
            } catch (err) {
                debug(err);
            }

            taskExecution.submitted_at = new Date();
            taskExecution.started_at = taskExecution.submitted_at;

            taskExecution.execution_status_code = ExecutionStatus.Running;

            await taskExecution.save();

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.

            // debug(opts);

            if (worker.cluster_work_capacity > 0) {
                await  LSFTaskManager.Instance.startTask(taskExecution);
            } else {
                await localTaskManager.startTask(taskExecution);
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
            // TODO Synchronize is currently disabled  (connection to remote database and task execution table on remote
            // has been removed during a refactor.
            const worker = await LocalPersistentStorageManager.Instance().Worker;

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
    if (taskExecution == null) {
        debug(`skipping update for null task execution (${taskExecution == null})`);
        return;
    }

    if (!isNullOrUndefined(jobUpdate.status)) {
        if (jobUpdate.status === JobStatus.Pending) {
            taskExecution.started_at = new Date();
            // taskExecution.last_process_status_code = jobUpdate.status;

            // await taskExecution.save();

            // return;
        }

        // if (jobUpdate.status === JobStatus.Online) {
        // taskExecution.last_process_status_code = jobUpdate.status;
        // await taskExecution.save();

        // return;
        // }

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
                        if (taskExecution.completion_status_code === CompletionResult.Success) {
                            fse.appendFileSync(`${taskExecution.resolved_log_path}-done.txt`, `Complete ${(new Date()).toUTCString()}`);
                        }
                        updateStatisticsForTaskId(taskExecution);
                    }
                }
            }

            MainQueue.Instance.SendTaskExecutionUpdate(taskExecution);
        }
    }

    if (!isNullOrUndefined(jobUpdate.statistics)) {
        if (!isNullOrUndefined(jobUpdate.statistics.memoryGB) && (jobUpdate.statistics.memoryGB > taskExecution.max_memory || isNaN(taskExecution.max_memory))) {
            taskExecution.max_memory = jobUpdate.statistics.memoryGB;
        }

        if (!isNullOrUndefined(jobUpdate.statistics.cpuPercent) && (jobUpdate.statistics.cpuPercent > taskExecution.max_cpu || isNaN(taskExecution.max_cpu))) {
            taskExecution.max_cpu = jobUpdate.statistics.cpuPercent;
        }
    }

    await taskExecution.save();
}
