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

const configurations: IConfiguration<IDatabaseConfig> = {
    development: {
        client: "sqlite3",
        connection: {
            filename: path.join(internalDataPath, "system-data-dev.sqlite3")
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    },
    test: {
        client: "sqlite3",
        connection: {
            filename: path.join(internalDataPath, "system-data-test.sqlite3")
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    },
    staging: {
        client: "sqlite3",
        connection: {
            filename: path.join(internalDataPath, "system-data-production.sqlite3")
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    },
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
    let env = process.env.NODE_ENV || "development";

    return configurations[env];
}
