import {knex} from "../data-access/knexConnector";

export interface ITableModelRow {
    id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date;
}

export abstract class TableModel<T extends ITableModelRow> {
    private _tableName = "";
    private _idKey = "";

    public constructor(tableName: string, idKey: string = "id") {
        this._tableName = tableName;
        this._idKey = idKey;
    }

    public async get(id: string): Promise<T> {
        let results = await this.fetch([id]);

        if (results && results.length > 0) {
            return results[0];
        } else {
            return null;
        }
    }

    public async getAll(includeSoftDelete: boolean = false) {
        let ids = await this._getIdList(includeSoftDelete);

        return this.fetch(ids);
    }

    public get idKey(): string {
        return this._idKey;
    }

    public get tableName(): string {
        return this._tableName;
    }

    public async count(): Promise<number> {
        return knex(this._tableName).whereNull("deleted_at").count("id");
    }

    public async insertRow(row: T) {
        await this.save(row);

        // Retrieves back through data loader
        row = await this.get(row.id);

        return row;
    }

    public async save(row: T) {
        row = this.willSaveRow(row);

        if (row.created_at == null) {
            row.created_at = new Date();

            await knex(this._tableName).insert(row);
        } else {
            if (!row.deleted_at) {
                row.updated_at = new Date();
            }

            await knex(this._tableName).where(this._idKey, row.id).update(row);
        }

        if (!row.deleted_at) {
            // Reload for caller.
            return this.get(row.id);
        } else {
            return null;
        }
    }

    public async softDelete(id: string): Promise<boolean> {
        let row: T = await this.get(id);

        if (row && row.created_at && !row.deleted_at) {
            row.deleted_at = new Date();

            this.willSoftDelete(row);

            await this.save(row);

            return true;
        }

        return false;
    }

    protected willSaveRow(row: T): T {
        return row;
    }

    protected didFetchRow(row: T): T {
        return row;
    }

    protected willSoftDelete(row: T): T {
        return row;
    }

    private async _getIdList(includeSoftDelete: boolean = false) {
        let objList;

        if (includeSoftDelete) {
            objList = await knex(this._tableName).select(this._idKey).orderBy("id");
        } else {
            objList = await knex(this._tableName).select(this._idKey).whereNull("deleted_at").orderBy("id");
        }

        return <string[]>objList.map(obj => obj.id);
    }

    protected fetch(keys: string[]): Promise<T[]> {
        return new Promise<T[]>((resolve) => {
            knex(this.tableName).whereIn(this.idKey, keys).orderBy("id").then((rows) => {
                rows = rows.map(row => {
                    return this.didFetchRow(row);
                });
                resolve(rows);
            });
        });
    }
}
