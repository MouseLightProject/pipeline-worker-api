import {knex} from "../data-access/knexConnector";
const AsyncLock = require("async");
import * as uuid from "node-uuid";

import {ITableModelRow, TableModel} from "./tableModel";
import {CompletionStatusCode, ITaskExecution} from "./taskExecution";

export interface ISystemProcessStatistics {
    memory_mb: number;
    cpu_percent: number;
}

export interface ITaskStatistics extends ITableModelRow {
    task_id: string;
    num_execute: number;
    num_complete: number;
    num_error: number;
    num_cancel: number;
    cpu_average: number;
    cpu_high: number;
    cpu_low: number;
    memory_average: number;
    memory_high: number;
    memory_low: number;
    duration_average: number;
    duration_high: number;
    duration_low: number;
}

interface IUpdateQueueTask {
    taskId: string;
    status: CompletionStatusCode;
    cpu: number;
    mem: number;
    duration_ms: number;
}

export class TaskStatistics extends TableModel<ITaskStatistics> {
    public constructor() {
        super("TaskStatistic");
    }

    public async getForTaskId(taskId: string): Promise<ITaskStatistics> {
        let objList = await knex(this.tableName).select(this.idKey).where({task_id: taskId});

        let idList = <string[]>objList.map(obj => obj.id);

        if (idList.length > 0) {
            let row = null;

            try {
                row = await this.dataLoader.load(idList[0]);
            } catch (err) {
                console.log(err);
            }

            return row;

        } else {
            return create(taskId);
        }
    }

    public async updateForTaskId(taskId: string, status: CompletionStatusCode, cpu: number, mem: number, duration_ms: number) {
        let statisticsForTask = await this.getForTaskId(taskId);

        if (!statisticsForTask) {
            return;
        }

        switch (status) {
            case CompletionStatusCode.Cancel:
                statisticsForTask.num_cancel++;
                break;
            case CompletionStatusCode.Error:
                statisticsForTask.num_error++;
                break;
            case CompletionStatusCode.Success:
                updatePerformanceStatistics(statisticsForTask, cpu, mem, duration_ms);
                statisticsForTask.num_complete++;
                break;
            default:
                return; // Should only be updated on completion of some form.
        }

        statisticsForTask.num_execute++;

        await this.save(statisticsForTask);
    }

    public async reset(now: boolean = false) {
        if (now) {
            await knex(this.tableName).select().del();

            this.dataLoader.clearAll();
        } else {
            queue.push(null, (err) => {
            });
        }

        return 0;
    }
}

function create(taskId: string) {
    return {
        id: uuid.v4(),
        task_id: taskId,
        num_execute: 0,
        num_complete: 0,
        num_error: 0,
        num_cancel: 0,
        cpu_average: 0,
        cpu_high: -Infinity,
        cpu_low: Infinity,
        memory_average: 0,
        memory_high: -Infinity,
        memory_low: Infinity,
        duration_average: 0,
        duration_high: -Infinity,
        duration_low: Infinity,
        created_at: null,
        updated_at: null,
        deleted_at: null
    };
}

function updatePerformanceStatistics(statisticsForTask: ITaskStatistics, cpu: number, mem: number, duration_ms: number) {
    updatePerformance(statisticsForTask, "cpu", cpu);
    updatePerformance(statisticsForTask, "memory", mem);
    updatePerformance(statisticsForTask, "duration", duration_ms / 1000 / 3600);
}

function updatePerformance(statisticsForTask: ITaskStatistics, statName: string, latestPerformance: number) {
    if (latestPerformance == null || isNaN(latestPerformance)) {
        return;
    }

    statisticsForTask[statName + "_average"] = updateAverage(statisticsForTask[statName + "_average"], statisticsForTask.num_complete, latestPerformance);
    statisticsForTask[statName + "_high"] = Math.max(statisticsForTask[statName + "_high"], latestPerformance);
    statisticsForTask[statName + "_low"] = Math.min(statisticsForTask[statName + "_low"], latestPerformance);
}

function updateAverage(existing_average: number, existing_count: number, latestValue: number) {
    return ((existing_average * existing_count) + latestValue ) / (existing_count + 1);
}

export const taskStatisticsInstance = new TaskStatistics();

const queue = AsyncLock.queue(async(updateTask: IUpdateQueueTask, callback) => {
    if (!updateTask) {
        await taskStatisticsInstance.reset(true);
    } else {

        try {
            await taskStatisticsInstance.updateForTaskId(updateTask.taskId, updateTask.status, updateTask.cpu, updateTask.mem, updateTask.duration_ms);
        } catch (err) {
            console.log(err);
        }
    }

    callback();
}, 1);

queue.error = (err) => {
    console.log("queue error");
};

export function updateStatisticsForTaskId(taskExecution: ITaskExecution) {
    let duration_ms = null;

    if (taskExecution.completed_at) {
        duration_ms = taskExecution.completed_at.valueOf() - taskExecution.started_at.valueOf();
    }

    queue.push({
        taskId: taskExecution.task_id, status: taskExecution.completion_status_code, cpu: taskExecution.max_cpu,
        mem: taskExecution.max_memory, duration_ms: duration_ms
    }, (err) => {
    });
}

