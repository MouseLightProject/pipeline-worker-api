import {FindOptions, InstanceSaveOptions} from "sequelize";
import {isNullOrUndefined} from "util";
import {ITaskDefinition} from "./taskDefinition";
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

export interface ITaskExecution {
    id?: string;
    worker_id: string;
    tile_id: string;
    task_definition_id: string;
    pipeline_stage_id: string;
    work_units: number;
    cluster_work_units: number;
    resolved_script: string;
    resolved_interpreter: string;
    resolved_script_args: string;
    resolved_cluster_args: string;
    resolved_log_path: string;
    expected_exit_code: number;
    queue_type: number,
    job_id: number,
    job_name: string,
    execution_status_code: ExecutionStatus;
    completion_status_code: CompletionResult;
    last_process_status_code: number;
    max_memory: number;
    max_cpu: number;
    exit_code: number;
    started_at: Date;
    completed_at: Date;
    sync_status?: SyncStatus;
    synchronized_at?: Date;
    registered_at?: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;

    // Not persistent;
    resolved_script_arg_array: string[];
    resolved_cluster_arg_array: string[];

    save?(options?: InstanceSaveOptions): any;
    get?(key?: string | any, options?: any): any;
}

export const TableName = "TaskExecutions";

export function sequelizeImport(sequelize, DataTypes) {
    const TaskExecution = sequelize.define(TableName, {
        id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
        },
        worker_id: {
            type: DataTypes.UUID
        },
        tile_id: {
            type: DataTypes.TEXT
        },
        task_definition_id: {
            type: DataTypes.UUID
        },
        pipeline_stage_id: {
            type: DataTypes.UUID
        },
        work_units: {
            type: DataTypes.INTEGER
        },
        cluster_work_units: {
            type: DataTypes.INTEGER
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
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_cluster_args: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_log_path: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        expected_exit_code: {
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
        max_memory: {
            type: DataTypes.FLOAT
        },
        max_cpu: {
            type: DataTypes.FLOAT
        },
        exit_code: {
            type: DataTypes.INTEGER
        },
        started_at: {
            type: DataTypes.DATE
        },
        sync_status: {
            type: DataTypes.INTEGER
        },
        completed_at: {
            type: DataTypes.DATE
        },
        synchronized_at: {
            type: DataTypes.DATE
        },
        registered_at: {
            type: DataTypes.DATE
        }
    }, {
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        deletedAt: "deleted_at",
        paranoid: false
    });

    TaskExecution.associate = models => {
        TaskExecution.belongsTo(models.TaskDefinitions, {foreignKey: "task_definition_id"});
    };

    TaskExecution.findRunning = async function (): Promise<ITaskExecution[]> {
        return TaskExecution.findAll({
            where: {execution_status_code: ExecutionStatus.Running},
            order: [["started_at", "DESC"]]
        });
    };

    TaskExecution.getPage = async function (reqOffset: number, reqLimit: number, completionCode: CompletionResult): Promise<ITaskExecution[]> {
        const options: FindOptions<ITaskExecution> = {
            offset: reqOffset,
            limit: reqLimit
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

    TaskExecution.createTask = async function (workerId: string, queueType: QueueType, taskDefinition: ITaskDefinition, pipelineStageId: string, tileId: string): Promise<ITaskExecution> {
        let taskExecution = createTaskFromDefinition(workerId, queueType, taskDefinition, pipelineStageId, tileId);

        return this.create(taskExecution);
    };

    return TaskExecution;
}

function createTaskFromDefinition(workerId: string, queueType: QueueType, taskDefinition: ITaskDefinition, pipelineStageId: string, tileId: string): ITaskExecution {
    return {
        worker_id: workerId,
        tile_id: tileId,
        task_definition_id: taskDefinition.id,
        pipeline_stage_id: pipelineStageId,
        work_units: taskDefinition.work_units,
        cluster_work_units: taskDefinition.cluster_work_units,
        resolved_script: null,
        resolved_interpreter: taskDefinition.interpreter,
        resolved_script_args: taskDefinition.script_args,
        resolved_cluster_args: taskDefinition.cluster_args,
        resolved_log_path: "",
        expected_exit_code: taskDefinition.expected_exit_code,
        queue_type: queueType,
        job_id: null,
        job_name: null,
        execution_status_code: ExecutionStatus.Initializing,
        completion_status_code: CompletionResult.Incomplete,
        last_process_status_code: null,
        max_memory: NaN,
        max_cpu: NaN,
        exit_code: null,
        started_at: null,
        completed_at: null,
        sync_status: SyncStatus.Never,
        synchronized_at: null,
        registered_at: null,
        created_at: null,
        updated_at: null,
        deleted_at: null,

        resolved_script_arg_array: [],
        resolved_cluster_arg_array: []
    };
}
