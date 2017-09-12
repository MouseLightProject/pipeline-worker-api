import {FindOptions, InstanceSaveOptions} from "sequelize";
import {isNullOrUndefined} from "util";
import {ITaskDefinition} from "./taskDefinition";

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

export enum SyncStatus {
    Never = 0,
    InProgress = 1,
    Complete = 2,
    Expired = 3
}

export interface ITaskExecution {
    id?: string;
    worker_id: string;
    task_definition_id: string;
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
    sync_status?: SyncStatus;
    synchronized_at?: Date;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;

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
            type: DataTypes.UUID,
        },
        task_definition_id: {
            type: DataTypes.UUID,
        },
        work_units: {
            type: DataTypes.INTEGER,
        },
        resolved_script: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_interpreter: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        resolved_args: {
            type: DataTypes.TEXT,
            defaultValue: ""
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

    TaskExecution.associate = models => {
        TaskExecution.belongsTo(models.TaskDefinitions, {foreignKey: "task_definition_id"});
    };

    TaskExecution.findRunning = async function (): Promise<ITaskExecution[]> {
        return TaskExecution.findAll({
            where: {execution_status_code: ExecutionStatusCode.Running},
            order: [["started_at", "DESC"]]
        });
    };

    TaskExecution.getPage = async function (reqOffset: number, reqLimit: number, completionCode: CompletionStatusCode): Promise<ITaskExecution[]> {
        const options: FindOptions<ITaskExecution> = {
            offset: reqOffset,
            limit: reqLimit
        };

        if (!isNullOrUndefined(completionCode)) {
            options.where = {completion_status_code: completionCode};
        }

        return TaskExecution.findAll(options);
    };

    TaskExecution.removeWithCompletionCode = async function (code: CompletionStatusCode): Promise<number> {
        if (isNullOrUndefined(code)) {
            code = CompletionStatusCode.Success;
        }

        return TaskExecution.destroy({where: {completion_status_code: code}});
    };

    TaskExecution.createTask = async function (workerId: string, taskDefinition: ITaskDefinition, scriptArgs: Array<string>): Promise<ITaskExecution> {
        let taskExecution = createTaskFromDefinition(workerId, taskDefinition, scriptArgs);

        return this.create(taskExecution);
    };

    return TaskExecution;
}

function createTaskFromDefinition(workerId: string, taskDefinition: ITaskDefinition, scriptArgs: Array<string>): ITaskExecution {

    return {
        worker_id: workerId,
        task_definition_id: taskDefinition.id,
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
        sync_status: SyncStatus.Never,
        synchronized_at: null,
        created_at: null,
        updated_at: null,
        deleted_at: null
    };
}
