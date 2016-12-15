const DataLoader = require("dataloader");
import * as uuid from "node-uuid";

import {knex} from "../data-access/knexConnector";
import {ITaskDefinition} from "./taskDefinition";
import {IProcessInfo, ExecutionStatus} from "../task-management/pm2-async";
import serverConfiguration from "../../config/server.config";

const debug = require("debug")("mouselight:worker-api:tasks");

const configuration = serverConfiguration();

export enum ExecutionStatusCode {
    Undefined = 0,
    Initializing = 1,
    Running = 2,
    Orphaned = 3,   // Was marked initialized/running but can not longer find in process manager list
    Completed = 4
}

export enum CompletionStatusCode {
    Unknown = 0,
    Incomplete = 1,
    Cancel = 2,
    Success = 3,
    Error = 4
}

export interface ITaskExecution {
    id: string;
    resolved_script: string;
    resolved_interpreter: string;
    execution_status_code: ExecutionStatusCode;
    completion_status_code: CompletionStatusCode;
    machine_id: string;
    started_at: Date;
    completed_at: Date;
    script_args: string;
    last_process_status_code: number;
    max_memory: number;
    max_cpu: number;
    exit_code: number;
    task_id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}

export class TaskExecutions {
    private static _tableName = "TaskExecutions";
    private static _idKey = "id";
    /*
     private static readonly _persistentProperties: string[] = [
     "id",
     "resolved_script",
     "resolved_interpreter",
     "execution_status_code",
     "completion_status_code",
     "machine_id",
     "started_at",
     "completed_at",
     "script_args",
     "last_process_status_code",
     "last_memory",
     "last_cpu",
     "task_id",
     "created_at",
     "updated_at",
     "deleted_at"
     ];
     */
    private _dataLoader: any;

    public constructor() {
        this._dataLoader = new DataLoader(TaskExecutions.fetch);
    }

    public async createTask(taskDefinition: ITaskDefinition, scriptArgs: Array<string>): Promise<ITaskExecution> {
        debug(`create task execution from definition ${taskDefinition.id}`);

        let taskExecution = _createTaskFromDefinition(taskDefinition, scriptArgs);

        await this.save(taskExecution);

        // Retrieves back through data loader
        taskExecution = await this.getTask(taskExecution.id);

        return taskExecution;
    }

    public getTask(id: string): Promise<ITaskExecution> {
        debug(`get task with id ${id}`);

        return this._dataLoader.load(id);
    }

    public async getTasks() {
        debug(`get all tasks`);

        let ids = await TaskExecutions._getIdList();

        let tasks = await this._dataLoader.loadMany(ids);

        tasks.sort((a, b) => {
            // Descending
            return b.updated_at - a.updated_at;
        });

        return tasks;
    }

    public async getRunningTasks() {
        debug(`get running tasks`);

        let ids = await TaskExecutions._getRunningIdList();

        return this._dataLoader.loadMany(ids);
    }

    public async save(taskExecution: ITaskExecution) {
        if (taskExecution.created_at == null) {
            debug(`creating new task execution ${taskExecution.id}`);

            taskExecution.created_at = new Date();

            await knex(TaskExecutions._tableName).insert(taskExecution);
        } else {
            debug(`saving updates for task execution ${taskExecution.id}`);

            if (!taskExecution.deleted_at) {
                taskExecution.updated_at = new Date();
            }

            await knex(TaskExecutions._tableName).where(TaskExecutions._idKey, taskExecution.id).update(taskExecution);

            this._dataLoader.clear(taskExecution.id);
        }

        // Reload for caller.
        return this.getTask(taskExecution.id);
    }

    public async clearAllComplete() {
        let count = await knex(TaskExecutions._tableName).where("execution_status_code", ExecutionStatusCode.Completed).del();

        this._dataLoader.clear();

        return count;
    }

    public async update(taskExecution: ITaskExecution, processInfo: IProcessInfo) {
        if (taskExecution == null || processInfo == null) {
            debug(`skipping update for null task execution (${taskExecution == null}) or process info (${processInfo == null})`);
            return;
        }

        // Have a real status from the process manager (e.g, PM2).
        if (processInfo.status > taskExecution.last_process_status_code) {
            taskExecution.last_process_status_code = processInfo.status;
        }

        // Stop/Exit/Delete
        if (processInfo.status >= ExecutionStatus.Stopped) {
            if (taskExecution.completed_at == null) {
                debug(`marking complete for task execution ${taskExecution.id}`);

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
            taskExecution.exit_code = processInfo.exitCode;
            taskExecution.completion_status_code = (processInfo.exitCode === 0) ? CompletionStatusCode.Success : CompletionStatusCode.Error;
        }

        // Basic stats
        if (processInfo.memory > taskExecution.max_memory) {
            taskExecution.max_memory = processInfo.memory;
        }

        if (processInfo.cpu > taskExecution.max_cpu) {
            taskExecution.max_cpu = processInfo.cpu;
        }

        await this.save(taskExecution);
    }

    private static async _getIdList() {
        let objList = await knex(TaskExecutions._tableName).select(TaskExecutions._idKey);

        return <string[]>objList.map(obj => obj.id);
    }

    private static async _getRunningIdList() {
        let objList = await knex(TaskExecutions._tableName).where("execution_status_code", ExecutionStatusCode.Running).select(TaskExecutions._idKey);

        return <string[]>objList.map(obj => obj.id);
    }

    private static fetch(keys: string[]): Promise<ITaskExecution[]> {
        return new Promise<TaskExecutions[]>((resolve) => {
            knex(TaskExecutions._tableName).whereIn(TaskExecutions._idKey, keys).then((tasks) => {
                let result = keys.map((key) => {
                    let task = tasks.filter((obj) => {
                        return obj.id === key;
                    });
                    return task.length > 0 ? task[0] : null;
                });
                resolve(result);
            });
        });
    }
}

function _createTaskFromDefinition(taskDefinition: ITaskDefinition, scriptArgs: Array<string>): ITaskExecution {
    return {
        id: uuid.v4(),
        resolved_script: null,
        resolved_interpreter: null,
        execution_status_code: ExecutionStatusCode.Initializing,
        completion_status_code: CompletionStatusCode.Incomplete,
        machine_id: configuration.hostInformation.machineId,
        started_at: null,
        completed_at: null,
        script_args: scriptArgs ? scriptArgs.join(", ") : "",
        last_process_status_code: null,
        max_memory: 0,
        max_cpu: 0,
        exit_code: null,
        task_id: taskDefinition.id,
        created_at: null,
        updated_at: null,
        deleted_at: null
    };
}
