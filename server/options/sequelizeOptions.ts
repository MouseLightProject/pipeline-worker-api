const path = require("path");
const fs = require("fs-extra");

export const internalDataPath = path.join(process.cwd(), "internal-data");

if (!fs.existsSync(internalDataPath)) {
    fs.mkdirSync(internalDataPath);
}

const databaseOptions = {
    production: {
        remote: {
            database: "pipeline_production",
            username: "postgres",
            password: "pgsecret",
            host: "pipeline-db",
            port: 5432,
            dialect: "postgres",
            logging: null
        },
        local: {
            database: "pipeline_production",
            username: null,
            password: null,
            dialect: "sqlite",
            storage:  path.join(internalDataPath, "worker-system-data.sqlite3"),
            logging: null
        }
    }
};

function loadDatabaseOptions() {
    const database = databaseOptions.production;

    const options = database.remote;

    options.host = process.env.PIPELINE_DATABASE_HOST || options.host;
    options.port = parseInt(process.env.PIPELINE_DATABASE_PORT) || options.port;
    options.username = process.env.PIPELINE_DATABASE_USER || options.username;
    options.password = process.env.PIPELINE_DATABASE_PASS || options.password;

    return database;
}

export const SequelizeOptions = loadDatabaseOptions();
