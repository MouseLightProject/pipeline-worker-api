const databaseOptions = {
    production: {
        database: "pipeline_production",
        username: "postgres",
        password: "pgsecret",
        host: "localhost",
        port: 4432,
        dialect: "postgres",
        logging: null
    }
};

function loadDatabaseOptions() {
    const host = process.env.PIPELINE_DATABASE_HOST || "localhost";
    const port = process.env.PIPELINE_DATABASE_PORT || 4432;
    const username = process.env.PIPELINE_DATABASE_USER || "postgres";
    const password = process.env.PIPELINE_DATABASE_PASS || "pgsecret";

    return Object.assign(databaseOptions.production, {host, port, password, username});
}

export const SequelizeOptions = loadDatabaseOptions();
