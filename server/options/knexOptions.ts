const path = require("path");
const fs = require("fs-extra");

export const internalDataPath = path.join(process.cwd(), "internal-data");

if (!fs.existsSync(internalDataPath)) {
    fs.mkdirSync(internalDataPath);
}

export interface IKnexOptions {
    client: string;
    connection: any;
    migrations: any;
    seeds?: any;
    acquireConnectionTimeout: number
    useNullAsDefault: boolean;
}

interface IKnexEnvs {
    production: IKnexOptions;
}

const configurations: IKnexEnvs = {
    production: {
        client: "sqlite3",
        connection: {
            filename: path.join(internalDataPath, "worker-system-data.sqlite3")
        },
        acquireConnectionTimeout: 180000,
        useNullAsDefault: true,
        migrations: {
            directory: "knex-migrations"
        }
    }
};

function loadConfiguration () {;
    return configurations.production;
}

export const KnexDatabaseConfiguration = loadConfiguration();
