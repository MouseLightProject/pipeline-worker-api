const path = require("path");
const fs = require("fs-extra");

export const internalDataPath = path.join(process.cwd(), "internal-data");

export interface IDatabaseServices {
    remote: any;
    local: any;
}

export interface ICoordinatorService {
    host: string;
    port: number;
    graphQLEndpoint: string;
}

export interface IMessageService {
    host: string;
    port: number;
}

export interface ICoreServices {

    databaseServices: IDatabaseServices;
    coordinatorApiService: ICoordinatorService;
    messageService: IMessageService;
}

const coreServicesOptions: ICoreServices = {
    databaseServices: {
        remote: {
            database: "pipeline_production",
            username: "postgres",
            password: "pgsecret",
            host: "pipeline-db",
            port: 5432,
            dialect: "postgres",
            logging: null,
            pool: {
                max: 5,
                min: 0,
                acquire: 20000,
                idle: 10000
            }
        },
        local: {
            database: "pipeline_production",
            username: null,
            password: null,
            dialect: "sqlite",
            storage: path.join(internalDataPath, "worker-system-data.sqlite3"),
            logging: null
        }
    },
    coordinatorApiService: {
        host: "pipeline-api",
        port: 6001,
        graphQLEndpoint: "/graphql"
    },
    messageService: {
        host: "pipeline-message-queue",
        port: 5672
    }
};

function loadDatabaseOptions(databaseServices) {
    const options = databaseServices.remote;

    options.host = process.env.PIPELINE_CORE_SERVICES_HOST || options.host;
    options.port = parseInt(process.env.PIPELINE_DATABASE_PORT) || options.port;
    options.username = process.env.PIPELINE_DATABASE_USER || options.username;
    options.password = process.env.PIPELINE_DATABASE_PASS || options.password;

    return databaseServices;
}

function loadCoordinatorOptions(options) {
    options.host = process.env.PIPELINE_API_HOST || options.host;
    options.port = parseInt(process.env.PIPELINE_API_PORT) || options.port;

    return options;
}


function loadCMessageQueueOptions(options) {
    options.host = process.env.PIPELINE_CORE_SERVICES_HOST || options.host;
    options.port = parseInt(process.env.PIPELINE_MESSAGE_PORT) || options.port;

    return options;
}

if (!fs.existsSync(internalDataPath)) {
    fs.mkdirSync(internalDataPath);
}

export const SequelizeOptions = loadDatabaseOptions(coreServicesOptions.databaseServices);
export const CoordinatorService = loadCoordinatorOptions(coreServicesOptions.coordinatorApiService);
export const MessageQueueService = loadCMessageQueueOptions(coreServicesOptions.messageService);
