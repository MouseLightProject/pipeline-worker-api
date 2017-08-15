import * as path from "path";
const Sequelize = require("sequelize");

const debug = require("debug")("pipeline:worker-api:database-connector");

import {loadModels} from "./modelLoader";
import {SequelizeOptions} from "../../options/sequelizeOptions";


export interface IPipelineModels {
    TaskDefinitions?: any;
    TaskRepositories?: any;
}

export interface ISequelizeDatabase<T> {
    connection: any;
    models: T;
    isConnected: boolean;
}

export class PersistentStorageManager {

    private pipelineDatabase: ISequelizeDatabase<IPipelineModels>;

    public static Instance(): PersistentStorageManager {
        return _manager;
    }

    public get IsConnected() {
        return this.pipelineDatabase && this.pipelineDatabase.isConnected;
    }

    public get PipelineConnection() {
        return this.pipelineDatabase.connection;
    }

    public get TaskRepositories() {
        return this.pipelineDatabase.models.TaskRepositories;
    }

    public get TaskDefinitions() {
        return this.pipelineDatabase.models.TaskDefinitions;
    }

    public async initialize() {
        this.pipelineDatabase = await createConnection({});
        await authenticate(this.pipelineDatabase, "pipeline");
    }
}

async function authenticate(database, name) {
    try {
        await database.connection.authenticate();

        database.isConnected = true;

        debug(`successful database connection: ${name}`);

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
    let databaseConfig = SequelizeOptions;

    let db: ISequelizeDatabase<T> = {
        connection: null,
        models: models,
        isConnected: false
    };

    db.connection = new Sequelize(databaseConfig.database, databaseConfig.username, databaseConfig.password, databaseConfig);

    return await loadModels(db, path.normalize(path.join(__dirname, "..", "..", "data-model", "sequelize")));
}

const _manager: PersistentStorageManager = new PersistentStorageManager();

_manager.initialize().then(() => {
});
