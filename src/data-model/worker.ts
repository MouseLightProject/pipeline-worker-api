import {v4} from "uuid";

const debug = require("debug")("pipeline:worker-api:worker-model");

import {ITableModelRow, TableModel} from "./tableModel";
import {isNullOrUndefined} from "util";

export interface IWorkerInput {
    id: string;
    preferred_network_interface_id: string;
    display_name: string;
    work_capacity: number;
    is_cluster_proxy: boolean;
    is_accepting_jobs: boolean;
}

export interface IWorker extends ITableModelRow {
    id: string;
    process_id?: number;
    preferred_network_interface_id: string;
    display_name: string;
    work_capacity: number;
    is_cluster_proxy: boolean;
    is_accepting_jobs: boolean;
}

export class Workers extends TableModel<IWorker> {
    private static _manager = new Workers();

    private _worker: IWorker = null;

    public static Instance(): Workers {
        return Workers._manager;
    }

    private constructor() {
        super("Worker");
    }

    public async worker(): Promise<IWorker> {
        if (this._worker !== null) {
            return this._worker;
        }

        try {
            const workers = await this.getAll();

            if (workers.length > 0) {
                debug(`found existing worker entry with id ${workers[0].id}`);

                this._worker = workers[0];
            } else {

                debug(`creating initial worker entry`);

                const worker = {
                    id: process.env.PIPELINE_WORKER_ID || v4(),
                    preferred_network_interface_id: null,
                    display_name: "",
                    work_capacity: 0,
                    is_cluster_proxy: false,
                    is_accepting_jobs: false,
                    created_at: null,
                    updated_at: null,
                    deleted_at: null
                };

                await this.save(worker);

                debug(`created worker entry with id `);

                this._worker = await this.get(worker.id);
            }
        } catch (err) {
            debug(err);
        }

        if (this._worker !== null) {
            this._worker.process_id = process.pid;
        }

        return this._worker;
    }

    public async updateFromInput(worker: IWorkerInput): Promise<IWorker> {
        const row = this._worker;

        row.preferred_network_interface_id = worker.preferred_network_interface_id || row.preferred_network_interface_id;
        row.display_name = worker.display_name || row.display_name;
        row.work_capacity = worker.work_capacity || row.work_capacity;
        row.is_cluster_proxy = isNullOrUndefined(worker.is_cluster_proxy) ?
            row.is_cluster_proxy : worker.is_cluster_proxy;
        row.is_accepting_jobs = worker.is_accepting_jobs || row.is_accepting_jobs;

        this._worker = await this.save(row);
        this._worker.process_id = process.pid;

        return this._worker;
    }
}
