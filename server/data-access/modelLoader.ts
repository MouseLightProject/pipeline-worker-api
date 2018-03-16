import {isNullOrUndefined} from "util";

const fs = require("fs");
const path = require("path");

import {ISequelizeDatabase} from "./remote/databaseConnector";
import {Sequelize} from "sequelize";

export interface IPersistentStorageManager {
    Connection: Sequelize;
    IsConnected: boolean;
}

export async function loadModels<T>(db: ISequelizeDatabase<T>, modelsLocation: string) {
    fs.readdirSync(modelsLocation).filter(file => {
        return (file.indexOf(".") !== 0) && (file.slice(-3) === ".js");
    }).forEach(file => {
        let modelModule = require(path.join(modelsLocation, file));

        const model = db.connection.import(path.join(modelsLocation, file), modelModule.sequelizeImport);

        db.models[model.name] = model;
    });

    return associateModels(db);
}

// If loading models individually caller is responsible for ensuring association is called.
export async function loadModel<T>(db: ISequelizeDatabase<T>, modelLocation: string) {
    if ((modelLocation.indexOf(".") === 0) || modelLocation.length < 4 || (modelLocation.slice(-3) !== ".js")) {
        return db;
    }

    let modelModule = require(modelLocation);

    const model = db.connection.import(modelLocation, modelModule.sequelizeImport);

    db.models[model.name] = model;

    return db;
}

export function associateModels<T>(db: ISequelizeDatabase<T>) {
    Object.keys(db.models).map(modelName => {
        if (!isNullOrUndefined(db.models[modelName].associate)) {
            db.models[modelName].associate(db.models);
        }
    });

    return db;
}
