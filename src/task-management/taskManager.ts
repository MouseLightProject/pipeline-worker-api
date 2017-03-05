import * as path from "path";

const debug = require("debug")("mouselight:worker-api:task-manager");

import {ITaskDefinition, TaskDefinitions, ITaskDefinitionInput} from "../data-model/taskDefinition";
import {ITaskExecution, TaskExecutions, ExecutionStatusCode, CompletionStatusCode} from "../data-model/taskExecution";
import {IProcessInfo, ExecutionStatus} from "./pm2-async";
import {ITaskStatistics, taskStatisticsInstance} from "../data-model/taskStatistics";
import * as ProcessManager from "./pm2-async";
import {Workers, IWorker, IWorkerInput} from "../data-model/worker";

export interface ITaskManager extends ProcessManager.IPM2MonitorDelegate {
    getTaskDefinition(id: string): Promise<ITaskDefinition>;
    getTaskDefinitions(): Promise<ITaskDefinition[]>;
    getTask(id: string): Promise<ITaskExecution>;
    getTasks(): Promise<ITaskExecution[]>;
    getStatistics(): Promise<ITaskStatistics[]>;
    statisticsForTask(id: string): Promise<ITaskStatistics>;
    getRunningTasks(): Promise<ITaskExecution[]>;

    updateTaskDefinition(taskDefinition: ITaskDefinitionInput): Promise<ITaskDefinition> ;
    updateWorker(worker: IWorkerInput): Promise<IWorker>;

    startTask(taskDefinitionId: string, scriptArgs: Array<string>): Promise<ITaskExecution>;
    stopTask(taskExecutionId: string): Promise<ITaskExecution>;

    removeCompletedExecutionsWithCode(code: CompletionStatusCode): Promise<number>;
    resetStatistics(taskId: string): Promise<number>;
}

export class TaskManager implements ITaskManager {
    public async connect() {
        await ProcessManager.connect();

        await ProcessManager.monitor(this);

        setInterval(async() => {
            await this.refreshTasksFromProcessManager();
        }, 5000);
    }

    private _taskDefinitions = new TaskDefinitions();
    private _taskExecutions = new TaskExecutions();

    public async processEvent(name: string, processInfo: IProcessInfo, manually: boolean): Promise<void> {
        debug(`handling event ${name} for ${processInfo.name} with status ${processInfo.status}`);

        return this.refreshOneTaskForProcess(processInfo, manually);
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

    public updateTaskDefinition(taskDefinition: ITaskDefinitionInput): Promise<ITaskDefinition> {
        return this._taskDefinitions.updateFromInput(taskDefinition);
    }

    public updateWorker(worker: IWorkerInput): Promise<IWorker> {
        return Workers.Instance().updateFromInput(worker);
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
        const taskDefinition = await this._taskDefinitions.get(taskDefinitionId);

        let customArgs = [];

        if (taskDefinition.args) {
            customArgs = taskDefinition.args.split(/[\s+]/).filter(Boolean);
        }

        const worker = await Workers.Instance().worker();

        const isClusterProxy = worker.is_cluster_proxy ? "1" : "0";

        const combinedArgs = scriptArgs.concat([isClusterProxy]).concat(customArgs);

        const taskExecution = await this._taskExecutions.createTask(taskDefinition, combinedArgs);

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

    private async refreshTasksFromProcessManager() {
        const processList: IProcessInfo[] = await ProcessManager.list();

        await Promise.all(processList.map(processInfo => this.refreshOneTaskForProcess(processInfo)));
    }

    private async refreshOneTaskForProcess(processInfo: IProcessInfo, manually: boolean = false): Promise<void> {
        const taskExecution = await this._taskExecutions.get(processInfo.name);

        if (taskExecution) {
            debug(`found task for refresh ${processInfo.name}`);

            await this._taskExecutions.update(taskExecution, processInfo, manually);

            if (taskExecution.execution_status_code === ExecutionStatusCode.Completed && processInfo.status === ExecutionStatus.Stopped) {
                debug(`removing completed process (${processInfo.managerId}) from process manager`);
                await ProcessManager.deleteTask(processInfo.managerId);
            }
        } else {
            debug(`unknown process info (not my task?) ${processInfo.name}`);
        }
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
}

export const taskManager = new TaskManager();

taskManager.connect().catch(err => {
    debug("failed to connect to process manager from graphql context.");
});


