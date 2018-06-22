import * as path from "path";

const sequelize = require("sequelize");

const debug = require("debug")("pipeline:worker-api:database-connector");

import {associateModels, IPersistentStorageManager, loadModel} from "../modelLoader";
import {SequelizeOptions} from "../../options/coreServicesOptions";
import {Sequelize} from "sequelize";
import {TaskExecutionModel} from "../../data-model/sequelize/taskExecution";
import {IWorker, IWorkerModel} from "../../data-model/sequelize/worker";
import {isNullOrUndefined} from "util";
import v4 = require("uuid/v4");


export interface IPipelineModels {
    Workers?: IWorkerModel;
    TaskExecutions?: TaskExecutionModel;
}

export interface ISequelizeDatabase<T> {
    connection: any;
    models: T;
    isConnected: boolean;
}

export class LocalPersistentStorageManager implements IPersistentStorageManager {

    private pipelineDatabase: ISequelizeDatabase<IPipelineModels>;

    private _worker: IWorker;

    public static Instance(): LocalPersistentStorageManager {
        return _manager;
    }

    public get IsConnected(): boolean {
        return this.pipelineDatabase && this.pipelineDatabase.isConnected;
    }

    public get Connection(): Sequelize {
        return this.pipelineDatabase.connection;
    }

    public get TaskExecutions() {
        return this.pipelineDatabase.models.TaskExecutions;
    }

    public get Workers() {
        return this.pipelineDatabase.models.Workers;
    }

    public get Worker(): IWorker {
        return this._worker;
    }

    public async initialize(): Promise<IWorker> {
        this.pipelineDatabase = createConnection({});
        return await this.authenticate(this.pipelineDatabase, "pipeline");
    }


    private async authenticate(database, name): Promise<IWorker> {
        try {
            associateModels(database);

            await database.connection.authenticate();

            database.isConnected = true;

            debug(`successful local database connection: ${name}`);


            if (!isNullOrUndefined(process.env.PIPELINE_WORKER_ID)) {
                [this._worker] = await this.pipelineDatabase.models.Workers.findOrCreate({where: {id: process.env.PIPELINE_WORKER_ID}});
            } else {
                this._worker = await this.pipelineDatabase.models.Workers.findOne();

                if (isNullOrUndefined(this._worker)) {
                    this._worker = await this.pipelineDatabase.models.Workers.create({id: v4()});
                }
            }

            return this._worker;
        } catch (err) {
            debug(`failed database connection: ${name}`);
            debug(err);

            setTimeout(() => this.authenticate(database, name), 5000);
        }
    }
}

function createConnection<T>(models: T) {
    let databaseConfig = SequelizeOptions.local;

    let db: ISequelizeDatabase<T> = {
        connection: null,
        models: models,
        isConnected: false
    };

    db.connection = new sequelize(databaseConfig.database, databaseConfig.username, databaseConfig.password, databaseConfig);

    db = loadModel(db, path.normalize(path.join(__dirname, "..", "..", "data-model", "sequelize", "taskExecution.js")));
    db = loadModel(db, path.normalize(path.join(__dirname, "..", "..", "data-model", "sequelize", "worker.js")));

    return db;
}

const _manager: LocalPersistentStorageManager = new LocalPersistentStorageManager();
