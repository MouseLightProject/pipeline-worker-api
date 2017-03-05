import * as uuid from "node-uuid";

const debug = require("debug")("mouselight:worker-api:worker-model");

import {ITableModelRow, TableModel} from "./tableModel";

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
    preferred_network_interface_id: string;
    display_name: string;
    work_capacity: number;
    is_cluster_proxy: boolean;
    is_accepting_jobs: boolean;
}

export class Workers extends TableModel<IWorker> {
    private static _manager = new Workers();

    public static Instance(): Workers {
        return Workers._manager;
    }

    private constructor() {
        super("Worker");
    }

    public async worker(): Promise<IWorker> {
        try {
            const workers = await this.getAll();

            if (workers.length > 0) {
                debug(`found existing worker entry with id ${workers[0].id}`);
                return workers[0];
            }

            debug(`creating initial worker entry`);

            const worker = {
                id: process.env.MACHINE_ID || uuid.v4(),
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

            return await this.get(worker.id);
        } catch (err) {
            debug(err);
        }
    }

    public async updateFromInput(worker: IWorkerInput): Promise<IWorker> {
        if (!worker.id || worker.id.length === 0) {
            return null;
        }

        let row = await this.get(worker.id);

        if (!row) {
            return null;
        }

        row.preferred_network_interface_id = worker.preferred_network_interface_id || row.preferred_network_interface_id;
        row.display_name = worker.display_name || row.display_name;
        row.work_capacity = worker.work_capacity || row.work_capacity;
        row.is_cluster_proxy = worker.is_cluster_proxy || row.is_cluster_proxy;
        row.is_accepting_jobs = worker.is_accepting_jobs || row.is_accepting_jobs;

        return await this.save(row);
    }
}
