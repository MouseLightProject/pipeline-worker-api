import {isNullOrUndefined} from "util";

const ChildProcess = require("child_process");
import * as ProcessManager from "./pm2-async";

const debug = require("debug")("pipeline:worker-api:task-manager");

import {IProcessInfo, ExecutionStatus} from "./pm2-async";
import {
    ISystemProcessStatistics, ITaskStatistics, taskStatisticsInstance,
    updateStatisticsForTaskId
} from "../data-model/taskStatistics";
import {Workers, IWorker, IWorkerInput} from "../data-model/worker";
import {RemotePersistentStorageManager} from "../data-access/remote/databaseConnector";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionStatusCode, ExecutionStatusCode, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {synchronizeTaskExecutions} from "../data-access/synchronize";

export interface ITaskManager extends ProcessManager.IPM2MonitorDelegate {
    getStatistics(): Promise<ITaskStatistics[]>;

    statisticsForTask(id: string): Promise<ITaskStatistics>;

    updateWorker(worker: IWorkerInput): Promise<IWorker>;

    startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;

    stopTask(taskExecutionId: string): Promise<ITaskExecution>;

    resetStatistics(taskId: string): Promise<number>;
}

export class TaskManager implements ITaskManager {
    private _remotePersistentStorageManager: RemotePersistentStorageManager = RemotePersistentStorageManager.Instance();

    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    public async connect() {
        await ProcessManager.connect();

        await ProcessManager.monitor(this);

        setTimeout(async () => {
            await this.refreshAllTasks();
        }, 0);

        setTimeout(async () => {
            await this.synchronizeUnsuccessfulTasks();
        }, 0)
    }

    private async refreshAllTasks() {
        try {
            await this.refreshTasksFromProcessManager();

            setTimeout(() => this.refreshAllTasks(), 60000);
        } catch (err) {
            debug(err);
        }
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

    public async processEvent(name: string, processInfo: IProcessInfo, manually: boolean): Promise<void> {
        // debug(`handling event ${name} for ${processInfo.name} with status ${processInfo.status}`);

        return this.refreshOneTaskForProcess(processInfo, manually);
    }

    public pm2Killed() {
        debug("pm2 delegate acknowledge kill event");
    }

    public getStatistics(): Promise<ITaskStatistics[]> {
        return taskStatisticsInstance.getAll();
    }

    public statisticsForTask(id: string): Promise<ITaskStatistics> {
        return taskStatisticsInstance.getForTaskId(id);
    }

    public updateWorker(worker: IWorkerInput): Promise<IWorker> {
        return Workers.Instance().updateFromInput(worker);
    }

    public resetStatistics(taskId: string): Promise<number> {
        return taskStatisticsInstance.reset(taskId);
    }

    // TODO Need a function to refresh what the database thinks are running tasks (find orphans, update stats, etc).
    // Should it be merged with refreshing the list from the process manager?  If we are only going to start through
    // this interface than the only ones that should exist that we"d care about should be known to us, unless there is
    // a bug where a process gets kicked off, but the initial save to database fails at creation.

    public async startTask(taskDefinitionId: string, pipelineStageId: string, tileId: string, scriptArgs: Array<string>) {
        const taskDefinition = await this._remotePersistentStorageManager.TaskDefinitions.findById(taskDefinitionId);

        let customArgs = [];

        if (taskDefinition.args) {
            customArgs = taskDefinition.args.split(/[\s+]/).filter(Boolean);
        }

        const worker = await Workers.Instance().worker();

        const isClusterProxy = worker.is_cluster_proxy ? "1" : "0";

        const combinedArgs = scriptArgs.concat(taskDefinition.expected_exit_code).concat([isClusterProxy]).concat(customArgs);

        const taskExecution = await this._localStorageManager.TaskExecutions.createTask(worker.id, taskDefinition, pipelineStageId, tileId, combinedArgs);

        return this._startTask(taskExecution, taskDefinition, combinedArgs);
    }

    public async stopTask(taskExecutionId: string): Promise<ITaskExecution> {
        try {
            let taskExecution = await this._localStorageManager.TaskExecutions.findById(taskExecutionId);

            if (taskExecution.completion_status_code < CompletionStatusCode.Cancel) {
                taskExecution.execution_status_code = ExecutionStatusCode.Orphaned;
                // Assume orphaned unless the process manager sends a completion event from stop() below.
                taskExecution.completion_status_code = CompletionStatusCode.Cancel;
            }

            await taskExecution.save();

            await ProcessManager.stop(taskExecutionId);

            return this._localStorageManager.TaskExecutions.findById(taskExecutionId);
        } catch (err) {
            // Null error means error in ProcessManager.stop() and already reported.
            if (err !== null) {
                debug(err);
            }
            return null;
        }
    }

    private async refreshTasksFromProcessManager() {
        const processList: IProcessInfo[] = await ProcessManager.list();

        await Promise.all(processList.map(processInfo => this.refreshOneTaskForProcess(processInfo)));
    }

    private async refreshOneTaskForProcess(processInfo: IProcessInfo, manually: boolean = false): Promise<void> {
        const taskExecution = await this._localStorageManager.TaskExecutions.findById(processInfo.name);

        if (taskExecution) {
            await _update(taskExecution, processInfo, manually);

            if (taskExecution.execution_status_code === ExecutionStatusCode.Completed && processInfo.status === ExecutionStatus.Stopped) {
                debug(`removing completed process (${processInfo.managerId}) from process manager`);
                await ProcessManager.deleteTask(processInfo.managerId);
            }
        }
    }

    private async _startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition, argsArray: string[]) {
        taskExecution.resolved_script = await taskDefinition.getFullScriptPath();

        taskExecution.resolved_interpreter = taskDefinition.interpreter;

        let opts = {
            name: taskExecution.id,
            script: taskExecution.resolved_script,
            args: argsArray,
            interpreter: taskDefinition.interpreter,
            exec_mode: "fork",
            autorestart: false,
            watch: false
        };

        taskExecution.started_at = new Date();

        try {
            taskExecution.execution_status_code = ExecutionStatusCode.Running;

            await taskExecution.save();

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.

            // debug(opts);

            await ProcessManager.start(opts);
        } catch (err) {
            debug(err);

            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatusCode.Completed;
            taskExecution.completion_status_code = CompletionStatusCode.Error;

            await taskExecution.save();
        }

        return this._localStorageManager.TaskExecutions.findById(taskExecution.id);
    }

}

export const taskManager = new TaskManager();

taskManager.connect().catch(err => {
    debug("failed to connect to process manager from graphql context.");
});

async function _update(taskExecution: ITaskExecution, processInfo: IProcessInfo, manually: boolean) {
    if (taskExecution == null || processInfo == null) {
        debug(`skipping update for null task execution (${taskExecution == null}) or process info (${processInfo == null})`);
        return;
    }

    if (processInfo.processId && processInfo.processId > 0) {
        let stats = await readProcessStatistics(processInfo.processId);

        if (!isNaN(stats.memory_mb) && (stats.memory_mb > taskExecution.max_memory || isNaN(taskExecution.max_memory))) {
            taskExecution.max_memory = stats.memory_mb;
        }

        if (!isNaN(stats.cpu_percent) && (stats.cpu_percent > taskExecution.max_cpu || isNaN(taskExecution.max_cpu))) {
            taskExecution.max_cpu = stats.cpu_percent;
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
                // Do not have control on how PM2 fires events.  Can't assumed we didn't get an exit code already.
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

function readProcessStatistics(processId): Promise<ISystemProcessStatistics> {
    return new Promise<ISystemProcessStatistics>((resolve, reject) => {
        ChildProcess.exec(`ps -A -o pid,pgid,rss,%cpu | grep ${processId}`, (err, stdout, stderr) => {
            if (err || stderr) {
                reject(err);
            }
            else {
                let stats: ISystemProcessStatistics = {
                    memory_mb: NaN,
                    cpu_percent: NaN
                };

                stdout = stdout.split(/\n/).filter(Boolean);

                let statsArray: Array<ISystemProcessStatistics> = stdout.map(obj => {
                    let parts = obj.split(/[\s+]/).filter(Boolean);

                    if (parts && parts.length === 4) {
                        return {
                            memory_mb: parseInt(parts[2]) / 1024,
                            cpu_percent: parseFloat(parts[3])
                        };
                    } else {
                        return null;
                    }
                }).filter(Boolean);

                stats = statsArray.reduce((prev, stats) => {
                    return {
                        memory_mb: isNaN(prev.memory_mb) ? stats.memory_mb : prev.memory_mb + stats.memory_mb,
                        cpu_percent: isNaN(prev.cpu_percent) ? stats.cpu_percent : prev.cpu_percent + stats.cpu_percent
                    };
                }, stats);

                resolve(stats);
            }
        });
    });
}
