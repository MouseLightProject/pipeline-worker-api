const databaseOptions = {
    production: {
        database: "pipeline_production",
        username: "postgres",
        password: "pgsecret",
        host: "pipeline-db",
        port: 5432,
        dialect: "postgres",
        logging: null
    }
};

function loadDatabaseOptions() {
    const options = databaseOptions.production;

    options.host = process.env.PIPELINE_DATABASE_HOST || options.host;
    options.port = parseInt(process.env.PIPELINE_DATABASE_PORT) || options.port;
    options.username = process.env.PIPELINE_DATABASE_USER || options.username;
    options.password = process.env.PIPELINE_DATABASE_PASS || options.password;

    return options;
}

export const SequelizeOptions = loadDatabaseOptions();
