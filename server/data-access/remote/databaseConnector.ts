import * as path from "path";

const sequelize = require("sequelize");

const debug = require("debug")("pipeline:worker-api:database-connector");

import {IPersistentStorageManager, loadModels} from "../modelLoader";
import {SequelizeOptions} from "../../options/sequelizeOptions";
import {TaskExecutionModel} from "../../data-model/sequelize/taskExecution";
import {Sequelize} from "sequelize";


export interface IPipelineModels {
    TaskDefinitions?: any;
    TaskRepositories?: any;
    // TaskExecutions?: TaskExecutionModel;
}

export interface ISequelizeDatabase<T> {
    connection: any;
    models: T;
    isConnected: boolean;
}

export class RemotePersistentStorageManager implements IPersistentStorageManager {

    private pipelineDatabase: ISequelizeDatabase<IPipelineModels>;

    public static Instance(): RemotePersistentStorageManager {
        return _manager;
    }

    public get IsConnected(): boolean {
        return this.pipelineDatabase && this.pipelineDatabase.isConnected;
    }

    public get Connection(): Sequelize {
        return this.pipelineDatabase.connection;
    }

    public get TaskRepositories() {
        return this.pipelineDatabase.models.TaskRepositories;
    }

    public get TaskDefinitions() {
        return this.pipelineDatabase.models.TaskDefinitions;
    }

    /*
    public get TaskExecutions() {
        return this.pipelineDatabase.models.TaskExecutions;
    }
    */

    public async initialize() {
        this.pipelineDatabase = await createConnection({});
        await authenticate(this.pipelineDatabase, "pipeline");
    }
}

async function authenticate(database, name) {
    try {
        await database.connection.authenticate();

        database.isConnected = true;

        debug(`successful remote database connection: ${name}`);

        Object.keys(database.models).map(modelName => {
            if (database.models[modelName].prepareContents) {
                database.models[modelName].prepareContents(database.models);
            }
        });
    } catch (err) {
        debug(`failed database connection: ${name}`);
        debug(err);

        setTimeout(() => authenticate(database, name), 5000);
    }
}

async function createConnection<T>(models: T) {
    let databaseConfig = SequelizeOptions.remote;

    let db: ISequelizeDatabase<T> = {
        connection: null,
        models: models,
        isConnected: false
    };

    db.connection = new sequelize(databaseConfig.database, databaseConfig.username, databaseConfig.password, databaseConfig);

    return await loadModels(db, path.normalize(path.join(__dirname, "..", "..", "data-model", "sequelize")));
}

const _manager: RemotePersistentStorageManager = new RemotePersistentStorageManager();

_manager.initialize().then(() => {
});
