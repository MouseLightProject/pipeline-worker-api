const path = require("path");
const fs = require("fs-extra");

import {IConfiguration} from "./configuration";

export const internalDataPath = path.join(process.cwd(), "internal-data");

if (!fs.existsSync(internalDataPath)) {
    fs.mkdirSync(internalDataPath);
}

interface IDatabaseConfig {
    client: string;
    connection: any;
    migrations: any;
    useNullAsDefault: boolean;
}

const configurations = {
    production: {
        client: "sqlite3",
        connection: {
            filename: path.join(internalDataPath, "system-data-production.sqlite3")
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    }
};

export default function () {

    return configurations.production;
}
