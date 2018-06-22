import {Instance, Model} from "sequelize";
import {isNullOrUndefined} from "util";

export interface IWorkerInput {
    id: string;
    preferred_network_interface_id: string;
    display_name: string;
    local_work_capacity: number;
    cluster_work_capacity: number;
    is_accepting_jobs: boolean;
}

export interface IWorkerAttributes {
    id: string;
    process_id?: number;
    display_name?: string;
    local_work_capacity?: number;
    cluster_work_capacity?: number;
    created_at?: Date;
    updated_at?: Date;
    deleted_at?: Date;
}

export interface IWorker extends Instance<IWorkerAttributes>, IWorkerAttributes {
    updateFromInput(worker: IWorkerInput): Promise<IWorker>;
}

export interface IWorkerModel extends Model<IWorker, IWorkerAttributes> {
    updateFromInput(worker: IWorkerInput): void;
}

export const TableName = "Workers";

export function sequelizeImport(sequelize, DataTypes) {
    const Worker = sequelize.define(TableName, {
        id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
        },
        display_name: {
            type: DataTypes.TEXT,
            defaultValue: ""
        },
        local_work_capacity: {
            type: DataTypes.FLOAT,
            defaultValue: 1
        },
        cluster_work_capacity: {
            type: DataTypes.FLOAT,
            defaultValue: 0
        },
        is_accepting_jobs: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
        deletedAt: "deleted_at",
        paranoid: true,
        getterMethods: {
            process_id() {
                return process.pid;
            }
        },
        classMethods: {
            updateFromInput: async (input: IWorkerInput) => {
                console.log("updateFromInput");
                console.log(this.toJSON());
            }
        }
    });

    Worker.prototype.updateFromInput = async function (input: IWorkerInput): Promise<IWorker> {
        return this.update({
            display_name: input.display_name || this.display_name,
            local_work_capacity: !isNullOrUndefined(input.local_work_capacity) ? input.local_work_capacity : this.local_work_capacity,
            cluster_work_capacity: !isNullOrUndefined(input.cluster_work_capacity) ? input.cluster_work_capacity : this.cluster_work_capacity,
            is_accepting_jobs: !isNullOrUndefined(input.is_accepting_jobs) ? input.is_accepting_jobs : this.is_accepting_jobs
        });
    };

    return Worker;
}
