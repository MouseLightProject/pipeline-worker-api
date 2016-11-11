const DataLoader = require("dataloader");

import {knex} from "../data-access/knexConnector";

export interface ITaskDefinition {
    id: string;
    name: string;
    description: string;
    script: string;
    interpreter: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}

export class TaskDefinitions {
    private _dataLoader: any;

    private static _tableName = "TaskDefinitions";
    private static _idKey = "id";

    public constructor() {
        this._dataLoader = new DataLoader(TaskDefinitions.fetch);
    }

    public get(id: string): Promise<ITaskDefinition> {
        return this._dataLoader.load(id);
    }

    public getAll(): Promise<ITaskDefinition[]> {
        return new Promise<ITaskDefinition[]>((resolve) => {
            knex(TaskDefinitions._tableName).select(TaskDefinitions._idKey).then((ids) => {
                this._dataLoader.loadMany(ids.map(obj => obj.id)).then((taskDefinitions) => {
                    resolve(taskDefinitions);
                });
            });
        });
    }

    private static fetch(keys: string[]): Promise<ITaskDefinition[]> {
        return new Promise<ITaskDefinition[]>((resolve) => {
            knex(TaskDefinitions._tableName).whereIn(TaskDefinitions._idKey, keys).then((tasks) => {
                resolve(tasks);
            });
        });
    }
}
