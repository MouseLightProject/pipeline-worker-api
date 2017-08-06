import {ITableModelRow, TableModel} from "./tableModel";
import {v4} from "uuid";
const ChildProcess = require("child_process");

import {knex} from "../data-access/knexConnector";
import {IProcessInfo, ExecutionStatus} from "../task-management/pm2-async";
import {updateStatisticsForTaskId, ISystemProcessStatistics} from "./taskStatistics";
import {Workers} from "./worker";
import {ITaskDefinition} from "./sequelize/taskDefinition";

const debug = require("debug")("pipeline:worker-api:tasks");

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

export interface ITaskExecution extends ITableModelRow {
    machine_id: string;
    task_id: string;
    work_units: number;
    resolved_script: string;
    resolved_interpreter: string;
    resolved_args: string;
    execution_status_code: ExecutionStatusCode;
    completion_status_code: CompletionStatusCode;
    last_process_status_code: number;
    max_memory: number;
    max_cpu: number;
    exit_code: number;
    started_at: Date;
    completed_at: Date;
}

export class TaskExecutions extends TableModel<ITaskExecution> {

    public constructor() {
        super("TaskExecution");
    }

    public async createTask(taskDefinition: ITaskDefinition, scriptArgs: Array<string>): Promise<ITaskExecution> {
        debug(`create task execution from definition ${taskDefinition.id}`);

        let taskExecution = await _createTaskFromDefinition(taskDefinition, scriptArgs);

        await this.save(taskExecution);

        // Retrieves back through data loader
        taskExecution = await this.get(taskExecution.id);

        return taskExecution;
    }

    public async getAll() {
        // ebug(`get all tasks`);

        let tasks = await super.getAll();

        tasks.sort((a, b) => {
            // Descending
            if (a.updated_at === null) {
                if (b.updated_at === null) {
                    return 0;
                } else {
                    return 1;
                }
            } else if (b.updated_at === null) {
                return -1;
            }

            return b.updated_at.valueOf() - a.updated_at.valueOf();
        });

        return tasks;
    }

    public async getPage(offset: number, limit: number): Promise<ITaskExecution[]> {
        const orderBy = "started_at";

        const objListObj = await knex(this.tableName).select(this.idKey).whereNull("deleted_at").orderBy(orderBy, "desc").offset(offset).limit(limit);

        const objList = <string[]>objListObj.map(obj => obj.id);

        return await this.fetch(objList, orderBy, false);
    }

    public async getRunningTasks() {
        // debug(`get running tasks`);

        let ids = await this._getRunningIdList();

        return this.fetch(ids);
    }

    async removeCompletedExecutionsWithCode(code: CompletionStatusCode): Promise<number> {
        if (code === undefined || code === null) {
            code = CompletionStatusCode.Success;
        }

        return await knex(this.tableName).where("completion_status_code", code).del();
    }

    public async update(taskExecution: ITaskExecution, processInfo: IProcessInfo, manually: boolean) {
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
                taskExecution.completion_status_code = (processInfo.exitCode === 0) ? CompletionStatusCode.Success : CompletionStatusCode.Error;
            }

            if (taskExecution.exit_code === null) {
                taskExecution.exit_code = processInfo.exitCode;

                updateStatisticsForTaskId(taskExecution);
            }
        }

        await this.save(taskExecution);
    }

    private async _getRunningIdList() {
        let objList = await knex(this.tableName).where("execution_status_code", ExecutionStatusCode.Running).select(this.idKey).orderBy("id");

        return <string[]>objList.map(obj => obj.id);
    }
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

async function _createTaskFromDefinition(taskDefinition: ITaskDefinition, scriptArgs: Array<string>): Promise<ITaskExecution> {
    const worker = await Workers.Instance().worker();

    return {
        id: v4(),
        machine_id: worker.id,
        task_id: taskDefinition.id,
        work_units: taskDefinition.work_units,
        resolved_script: null,
        resolved_interpreter: null,
        resolved_args: scriptArgs ? scriptArgs.join(", ") : "",
        execution_status_code: ExecutionStatusCode.Initializing,
        completion_status_code: CompletionStatusCode.Incomplete,
        last_process_status_code: null,
        max_memory: NaN,
        max_cpu: NaN,
        exit_code: null,
        started_at: null,
        completed_at: null,
        created_at: null,
        updated_at: null,
        deleted_at: null
    };
}
