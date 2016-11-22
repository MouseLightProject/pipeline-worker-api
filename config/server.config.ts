import {IConfiguration} from "./configuration";

export interface IServerConfig {
    port: number;
    graphQlEndpoint: string;
    graphiQlEndpoint: string;
    machineId: string;
    serverHost: string;
    serverPort: number;
    serverGraphQlEndpoint: string;
}

const configurations: IConfiguration<IServerConfig> = {
    development: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
        serverHost: "localhost",
        serverPort: 3000,
        serverGraphQlEndpoint: "/graphql"
    },
    test: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
        serverHost: "localhost",
        serverPort: 3000,
        serverGraphQlEndpoint: "/graphql"
    },
    production: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
        serverHost: "pipelineServer",
        serverPort: 3000,
        serverGraphQlEndpoint: "/graphql"
    }
};

function overrideDefaults(config: IServerConfig): IServerConfig {
    config.port = process.env.PORT || config.port;

    config.serverHost = process.env.SERVER_HOST || config.serverHost;
    config.serverPort = process.env.SERVER_PORT || config.serverPort;

    config.machineId = process.env.MACHINE_ID || config.machineId;

    return config;
}

export default function (): IServerConfig {
    let env = process.env.NODE_ENV || "development";

    return overrideDefaults(configurations[env]);
}
