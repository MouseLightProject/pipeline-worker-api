import {FindOptions, Instance, Model} from "sequelize";
import {isNullOrUndefined} from "util";
import {QueueType} from "../../task-management/taskSupervisor";

export enum ExecutionStatus {
    Undefined = 0,
    Initializing = 1,
    Running = 2,
    Zombie = 3,   // Was marked initialized/running but can not longer find in process manager list/cluster jobs
    Orphaned = 4, // Found in process manager with metadata that associates to worker, but no linked task in database
    Completed = 5
}

export enum CompletionResult {
    Unknown = 0,
    Incomplete = 1,
    Cancel = 2,
    Success = 3,
    Error = 4,
    Resubmitted = 5
}

export enum SyncStatus {
    Never = 0,
    InProgress = 1,
    Complete = 2,
    Expired = 3
}

export interface ITaskExecutionAttributes {
    id?: string;
    worker_id: string;
    remote_task_execution_id?: string;
    tile_id: string;
    task_definition_id: string;
    pipeline_stage_id: string;
    queue_type: number,
    local_work_units: number;
    cluster_work_units: number;
    resolved_output_path: string;
    resolved_script: string;
    resolved_interpreter: string;
    resolved_script_args: string;
    resolved_cluster_args: string;
    resolved_log_path: string;
    expected_exit_code: number;
    job_id: number,
    job_name: string,
    execution_status_code: ExecutionStatus;
    completion_status_code: CompletionResult;
    last_process_status_code: number;
    cpu_time_seconds: number;
    max_cpu_percent: number;
    max_memory_mb: number;
    exit_code: number;
    submitted_at: Date;
    started_at: Date;
    completed_at: Date;
    sync_status?: SyncStatus;
    synchronized_at?: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}

export interface ITaskExecution extends Instance<ITaskExecutionAttributes>, ITaskExecutionAttributes {
}

export interface TaskExecutionModel extends Model<ITaskExecution, ITaskExecutionAttributes> {
    findRunning(): Promise<ITaskExecution[]>;
    findRunningByQueueType(queueType: QueueType): Promise<ITaskExecution[]>;
    getPage(reqOffset: number, reqLimit: number, completionCode: CompletionResult): Promise<ITaskExecution[]>;
    removeWithCompletionCode(code: CompletionResult): Promise<number>;
}

export const TableName = "TaskExecutions";

export function sequelizeImport(sequelize, DataTypes) {
    const TaskExecution = sequelize.define(TableName, {
        id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
        },
        remote_task_execution_id: {
            type: DataTypes.UUID,
        },
        task_definition_id: {
            type: DataTypes.UUID
        },
        pipeline_stage_id: {
            type: DataTypes.UUID
        },
        tile_id: {
            type: DataTypes.TEXT
        },
        resolved_output_path: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_script: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_interpreter: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_script_args: {
            type: DataTypes.TEXT
        },
        resolved_cluster_args: {
            type: DataTypes.TEXT
        },
        resolved_log_path: {
            type: DataTypes.TEXT
        },
        expected_exit_code: {
            type: DataTypes.INTEGER
        },
        worker_id: {
            type: DataTypes.UUID
        },
        local_work_units: {
            type: DataTypes.INTEGER
        },
        cluster_work_units: {
            type: DataTypes.INTEGER
        },
        queue_type: {
            type: DataTypes.INTEGER
        },
        job_id: {
            type: DataTypes.INTEGER
        },
        job_name: {
            type: DataTypes.TEXT
        },
        execution_status_code: {
            type: DataTypes.INTEGER
        },
        completion_status_code: {
            type: DataTypes.INTEGER
        },
        last_process_status_code: {
            type: DataTypes.INTEGER
        },
        cpu_time_seconds: {
            type: DataTypes.FLOAT
        },
        max_cpu_percent: {
            type: DataTypes.FLOAT
        },
        max_memory_mb: {
            type: DataTypes.FLOAT
        },
        exit_code: {
            type: DataTypes.INTEGER
        },
        submitted_at: {
            type: DataTypes.DATE
        },
        started_at: {
            type: DataTypes.DATE
        },
        completed_at: {
            type: DataTypes.DATE
        },
        sync_status: {
            type: DataTypes.INTEGER
        },
        synchronized_at: {
            type: DataTypes.DATE
        }
    }, {
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        deletedAt: "deleted_at",
        paranoid: false
    });

    TaskExecution.findRunning = async function (): Promise<ITaskExecution[]> {
        return TaskExecution.findAll({
            where: {execution_status_code: ExecutionStatus.Running},
            order: [["submitted_at", "DESC"]]
        });
    };

    TaskExecution.findRunningByQueueType = async function (queueType: QueueType): Promise<ITaskExecution[]> {
        return TaskExecution.findAll({
            where: {execution_status_code: ExecutionStatus.Running, queue_type: queueType}
        });
    };

    TaskExecution.getPage = async function (reqOffset: number, reqLimit: number, completionCode: CompletionResult): Promise<ITaskExecution[]> {
        const options: FindOptions<ITaskExecutionAttributes> = {
            offset: reqOffset,
            limit: reqLimit,
            order: [["completed_at", "DESC"]]
        };

        if (!isNullOrUndefined(completionCode)) {
            options.where = {completion_status_code: completionCode};
        }

        return TaskExecution.findAll(options);
    };

    TaskExecution.removeWithCompletionCode = async function (code: CompletionResult): Promise<number> {
        if (isNullOrUndefined(code)) {
            code = CompletionResult.Success;
        }

        return TaskExecution.destroy({where: {completion_status_code: code}});
    };

    return TaskExecution;
}
