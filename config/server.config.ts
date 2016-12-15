import {IConfiguration} from "./configuration";

export interface IHostInformation {
    machineId: string;
    name: string;
    osType: string;
    platform: string;
    arch: string;
    release: string;
    cpuCount: number;
    totalMemory: number;
    freeMemory: number;
    loadAverage: number;
}

// To establish socket.io, graphql, and any other connections.  In place of having a general discovery service.

export interface IManagementServiceConfiguration {
    host: string;
    port: number;
    graphQLEndpoint: string;
}
export interface IServerConfig {
    port: number;
    graphQlEndpoint: string;
    graphiQlEndpoint: string;
    hostInformation: IHostInformation;
    managementService: IManagementServiceConfiguration;
}

const configurations: IConfiguration<IServerConfig> = {
    development: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        hostInformation: {
            machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
            name: "",
            osType: "",
            platform: "",
            arch: "",
            release: "",
            cpuCount: 0,
            totalMemory: 0,
            freeMemory: 0,
            loadAverage: 0
        },
        managementService: {
            host: "localhost",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    },
    test: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        hostInformation: {
            machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
            name: "",
            osType: "",
            platform: "",
            arch: "",
            release: "",
            cpuCount: 0,
            totalMemory: 0,
            freeMemory: 0,
            loadAverage: 0
        },
        managementService: {
            host: "localhost",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    },
    production: {
        port: 3001,
        graphQlEndpoint: "/graphql",
        graphiQlEndpoint: "/graphiql",
        hostInformation: {
            machineId: "1BCC812D-97CE-4B14-AD48-5C3C9B9B416E".toLocaleLowerCase(),
            name: "",
            osType: "",
            platform: "",
            arch: "",
            release: "",
            cpuCount: 0,
            totalMemory: 0,
            freeMemory: 0,
            loadAverage: 0
        },
        managementService: {
            host: "pipelineServer",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    }
};

function overrideDefaults(config: IServerConfig): IServerConfig {
    config.port = process.env.PORT || config.port;

    config.managementService.host = process.env.SERVER_HOST || config.managementService.host;
    config.managementService.port = process.env.SERVER_PORT || config.managementService.port;

    config.hostInformation.machineId = process.env.MACHINE_ID || config.hostInformation.machineId;

    return config;
}

export default function (): IServerConfig {
    let env = process.env.NODE_ENV || "development";

    return overrideDefaults(configurations[env]);
}
