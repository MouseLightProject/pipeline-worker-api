import {IConfiguration} from "./configuration";

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
            filename: "./dev.sqlite3"
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    },
    test: {
        client: "sqlite3",
        connection: {
            filename: "./test.sqlite3"
        },
        useNullAsDefault: true,
        migrations: {
            tableName: "knex_migrations"
        }
    },
    production: {
        client: "sqlite3",
        connection: {
            filename: "./production.sqlite3"
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
