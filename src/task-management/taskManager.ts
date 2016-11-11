import * as path from "path";

import {ITaskDefinition, TaskDefinitions} from "../data-model/taskDefinition";
import {ITaskExecution, TaskExecutions, ExecutionStatusCode, CompletionStatusCode} from "../data-model/taskExecution";
import * as ProcessManager from "./pm2-async";
import {IProcessInfo, ExecutionStatus} from "./pm2-async";

const debug = require("debug")("mouselight:worker-api:task-manager");

export interface ITaskManager extends ProcessManager.IPM2MonitorDelegate {
    getTaskDefinitions(): Promise<ITaskDefinition[]>;
    getTask(id: string): Promise<ITaskExecution>;
    getTasks(): Promise<ITaskExecution[]>;
    getRunningTasks(): Promise<ITaskExecution[]>;
    startTask(taskDefinitionId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;
    refreshTasksFromProcessManager();
    refreshTaskFromProcessManager(taskExecutionId: string);
    // deleteTask(taskExecutionId: string);
}

export class TaskManager implements ITaskManager {
    public async connect() {
        await ProcessManager.connect();

        await ProcessManager.monitor(this);

        setInterval(() => {
            this.refreshTasksFromProcessManager();
        }, 3000);
    }

    private _taskDefinitions = new TaskDefinitions();
    private _taskExecutions = new TaskExecutions();

    public processEvent(name: string, processInfo: IProcessInfo) {
        debug(`Handling event ${name} for ${processInfo.name} with status ${processInfo.status}`);
        this._updateTask(processInfo);
    }

    public pm2Killed() {
        debug("pm2 delegate acknowledge kill event");
    }

    public getTaskDefinitions(): Promise<ITaskDefinition[]> {
        return this._taskDefinitions.getAll();
    }

    public getTask(id: string): Promise<ITaskExecution> {
        return this._taskExecutions.getTask(id);
    }

    public getTasks(): Promise<ITaskExecution[]> {
        return this._taskExecutions.getTasks();
    }

    public getRunningTasks(): Promise<ITaskExecution[]> {
        return this._taskExecutions.getRunningTasks();
    }

    // TODO Need a function to refresh what the database thinks are running tasks (find orphans, update stats, etc).
    // Should it be merged with refreshing the list from the process manager?  If we are only going to start through
    // this interface than the only ones that should exist that we'd care about should be known to us, unless there is
    // a bug where a process gets kicked off, but the initial save to database fails at creation.

    public async startTask(taskDefinitionId: string, scriptArgs: Array<string>) {
        let taskDefinition = await this._taskDefinitions.get(taskDefinitionId);

        let taskExecution = await this._taskExecutions.createTask(taskDefinition, scriptArgs);

        return this._startTask(taskExecution, taskDefinition, scriptArgs);
    }

    public async refreshTasksFromProcessManager() {
        let processList: IProcessInfo[] = await ProcessManager.list();

        // Get TaskExecution object for each PM2 entry (if exists)
        let taskList: ITaskExecution[] = await Promise.all(processList.map((processInfo) => {
            return this._taskExecutions.getTask(processInfo.name);
        }));

        // Map updated info where applicable
        await Promise.all(taskList.map((taskExecution, index) => {
            if (taskExecution === undefined) {
                debug(`unknown PM2 process with name ${processList[index].name}`);
                return null;
            }

            this._taskExecutions.update(taskExecution, processList[index]);

            if (taskExecution.execution_status_code === ExecutionStatusCode.Completed && processList[0].status === ExecutionStatus.Stopped) {
                debug(`removing completed process (${processList[index].managerId}) from process manager`);
                ProcessManager.deleteTask(processList[index].managerId);
            }
        }));

        // Only return PM2 processes that map to something we started.
        return taskList.filter((task) => {
            return task != null;
        });
    }

    public async refreshTaskFromProcessManager(taskExecutionId: string) {
        let taskExecution = await this._taskExecutions.getTask(taskExecutionId);

        let matchingProcessInfo = this._findProcessId(taskExecutionId);

        if (matchingProcessInfo && taskExecution) {
            await this._taskExecutions.update(taskExecution, matchingProcessInfo[0]);
        }

        return taskExecution;
    }

    /*
     public async deleteTask(taskExecutionId: string) {
     let matchingProcessInfo: IProcessInfo = await this._findProcessId(taskExecutionId);

     if (matchingProcessInfo) {
     await ProcessManager.del(matchingProcessInfo.managerId);
     }

     let taskExecution = await this._taskExecutions.getTask(taskExecutionId);

     return taskExecution;
     }
     */

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

            // Not using returned processInfo - using bus messages to get start/online events.  Handling directly here
            // is a race condition with start/exit events for a fast completion process.
            ProcessManager.start(opts);
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

    private async _updateTask(processInfo: IProcessInfo) {
        let taskExecution: ITaskExecution = null;

        if (processInfo != null) {

            taskExecution = await this._taskExecutions.getTask(processInfo.name);

            if (taskExecution != null) {
                debug(`updating task event ${taskExecution.id}`);
                await this._taskExecutions.update(taskExecution, processInfo);
            }
        }

        return taskExecution;
    }
}
