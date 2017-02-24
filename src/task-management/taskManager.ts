import * as path from "path";

import {ITaskDefinition, TaskDefinitions} from "../data-model/taskDefinition";
import {ITaskExecution, TaskExecutions, ExecutionStatusCode, CompletionStatusCode} from "../data-model/taskExecution";
import * as ProcessManager from "./pm2-async";
import {IProcessInfo, ExecutionStatus} from "./pm2-async";
import {ITaskStatistics, TaskStatistics, taskStatisticsInstance} from "../data-model/taskStatistics";

const debug = require("debug")("mouselight:worker-api:task-manager");

export interface ITaskManager extends ProcessManager.IPM2MonitorDelegate {
    getTaskDefinitions(): Promise<ITaskDefinition[]>;
    getTaskDefinition(id: string): Promise<ITaskDefinition>;
    getTask(id: string): Promise<ITaskExecution>;
    getTasks(): Promise<ITaskExecution[]>;
    getStatistics(): Promise<ITaskStatistics[]>;
    statisticsForTask(id: string): Promise<ITaskStatistics>;
    getRunningTasks(): Promise<ITaskExecution[]>;
    startTask(taskDefinitionId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;
    stopTask(taskExecutionId: string): Promise<ITaskExecution>;
    refreshTasksFromProcessManager();
    refreshTaskFromProcessManager(taskExecutionId: string);
    removeCompletedExecutionsWithCode(code: CompletionStatusCode): Promise<number>;
    resetStatistics(taskId: string): Promise<number>;
}

export class TaskManager implements ITaskManager {
    public async connect() {
        await ProcessManager.connect();

        await ProcessManager.monitor(this);

        setInterval(async() => {
            await this.refreshTasksFromProcessManager();
        }, 3000);
    }

    private _taskDefinitions = new TaskDefinitions();
    private _taskExecutions = new TaskExecutions();

    public async processEvent(name: string, processInfo: IProcessInfo, manually: boolean) {
        debug(`Handling event ${name} for ${processInfo.name} with status ${processInfo.status}`);

        await this._updateTask(processInfo, manually);
    }

    public pm2Killed() {
        debug("pm2 delegate acknowledge kill event");
    }

    public getTaskDefinitions(): Promise<ITaskDefinition[]> {
        return this._taskDefinitions.getAll();
    }

    public getTaskDefinition(id: string): Promise<ITaskDefinition> {
        return this._taskDefinitions.get(id);
    }

    public getTask(id: string): Promise<ITaskExecution> {
        return this._taskExecutions.get(id);
    }

    public getTasks(): Promise<ITaskExecution[]> {
        return this._taskExecutions.getAll();
    }

    public getRunningTasks(): Promise<ITaskExecution[]> {
        return this._taskExecutions.getRunningTasks();
    }

    public getStatistics(): Promise<ITaskStatistics[]> {
        return taskStatisticsInstance.getAll();
    }

    public statisticsForTask(id: string): Promise<ITaskStatistics> {
        return taskStatisticsInstance.getForTaskId(id);
    }

    public removeCompletedExecutionsWithCode(code: CompletionStatusCode): Promise<number> {
        return this._taskExecutions.removeCompletedExecutionsWithCode(code);
    }

    public resetStatistics(taskId: string): Promise<number> {
        return taskStatisticsInstance.reset(taskId);
    }

    // TODO Need a function to refresh what the database thinks are running tasks (find orphans, update stats, etc).
    // Should it be merged with refreshing the list from the process manager?  If we are only going to start through
    // this interface than the only ones that should exist that we'd care about should be known to us, unless there is
    // a bug where a process gets kicked off, but the initial save to database fails at creation.

    public async startTask(taskDefinitionId: string, scriptArgs: Array<string>) {
        let taskDefinition = await this._taskDefinitions.get(taskDefinitionId);

        let customArgs = [];

        if (taskDefinition.args) {
            customArgs = taskDefinition.args.split(/[\s+]/).filter(Boolean);
        }

        let combinedArgs = scriptArgs.concat(customArgs);

        let taskExecution = await this._taskExecutions.createTask(taskDefinition, combinedArgs);

        return this._startTask(taskExecution, taskDefinition, combinedArgs);
    }

    public async stopTask(taskExecutionId: string) {
        let taskExecution = await this._taskExecutions.get(taskExecutionId);

        if (taskExecution.completion_status_code < CompletionStatusCode.Cancel) {
            taskExecution.completion_status_code = CompletionStatusCode.Cancel;
        }

        await this._taskExecutions.save(taskExecution);

        await ProcessManager.stop(taskExecutionId);

        return await this._taskExecutions.get(taskExecutionId);
    }

    public async refreshTasksFromProcessManager() {
        let processList: IProcessInfo[] = await ProcessManager.list();

        // Get TaskExecution object for each PM2 entry (if exists)
        let taskList: ITaskExecution[] = await Promise.all(processList.map((processInfo) => {
            return this._taskExecutions.get(processInfo.name);
        }));

        // Map updated info where applicable
        await Promise.all(taskList.map(async(taskExecution, index) => {
            if (taskExecution === undefined) {
                debug(`unknown PM2 process with name ${processList[index].name}`);
                return null;
            }

            await this._taskExecutions.update(taskExecution, processList[index], false);

            if (taskExecution.execution_status_code === ExecutionStatusCode.Completed && processList[0].status === ExecutionStatus.Stopped) {
                debug(`removing completed process (${processList[index].managerId}) from process manager`);
                await ProcessManager.deleteTask(processList[index].managerId);
            }
        }));

        // Only return PM2 processes that map to something we started.
        return taskList.filter((task) => {
            return task != null;
        });
    }

    public async refreshTaskFromProcessManager(taskExecutionId: string) {
        let taskExecution = await this._taskExecutions.get(taskExecutionId);

        let matchingProcessInfo = this._findProcessId(taskExecutionId);

        if (matchingProcessInfo && taskExecution) {
            await this._taskExecutions.update(taskExecution, matchingProcessInfo[0], false);
        }

        return taskExecution;
    }

    private async _startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition, argsArray: string[]) {
        taskExecution.resolved_script = path.normalize(path.isAbsolute(taskDefinition.script) ? taskDefinition.script : (process.cwd() + "/" + taskDefinition.script));
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

            await this._taskExecutions.save(taskExecution);

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.

            await ProcessManager.start(opts);
        } catch (_) {
            taskExecution.completed_at = new Date();
            taskExecution.execution_status_code = ExecutionStatusCode.Completed;
            taskExecution.completion_status_code = CompletionStatusCode.Error;

            await this._taskExecutions.save(taskExecution);
        }

        return taskExecution;
    }

    private async _findProcessId(taskExecutionId: string) {
        let processList: IProcessInfo[] = await ProcessManager.list();

        let matchingProcessInfo: IProcessInfo[] = processList.filter((processInfo) => {
            return processInfo.name === taskExecutionId;
        });

        return (matchingProcessInfo.length > 0) ? matchingProcessInfo[0] : null;
    }

    private async _updateTask(processInfo: IProcessInfo, manually: boolean) {
        let taskExecution: ITaskExecution = null;

        if (processInfo != null) {

            taskExecution = await this._taskExecutions.get(processInfo.name);

            if (taskExecution != null) {
                debug(`updating task event ${taskExecution.id}`);
                await this._taskExecutions.update(taskExecution, processInfo, manually);
            }
        }

        return taskExecution;
    }
}

export const taskManager = new TaskManager();

taskManager.connect().catch(err => {
    debug("Failed to connect to process manager from graphql context.");
});


