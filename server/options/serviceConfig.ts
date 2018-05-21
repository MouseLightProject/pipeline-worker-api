const os = require("os");

const debug = require("debug")("pipeline:worker-api:configuration");

export interface IApiServiceConfiguration {
    name: string;
    networkInterface: string;
    networkAddress: string;
    networkPort: number;
    graphQlEndpoint: string;
    graphiQlEndpoint: string;
}

// To establish socket.io, graphql, and any other connections.  In place of having a general discovery service.

export interface IManagementServiceConfiguration {
    host: string;
    port: number;
    graphQLEndpoint: string;
}

export interface IMessageServiceConfiguration {
    host: string;
    port: number;
}

export interface IServerConfig {
    apiService: IApiServiceConfiguration;
    managementService: IManagementServiceConfiguration;
    messageService: IMessageServiceConfiguration;
}

const configurations = {
    production: {
        apiService: {
            name: "",
            networkInterface: "",
            networkAddress: "",
            networkPort: 6201,
            graphQlEndpoint: "/graphql",
            graphiQlEndpoint: "/graphiql"
        },
        managementService: {
            host: "pipeline-api",
            port: 6001,
            graphQLEndpoint: "/graphql"
        },
        messageService: {
            host: "pipeline-message-queue",
            port: 5672
        }
    }
};

function overrideDefaults(config: IServerConfig): IServerConfig {
    let networkProperties: INetworkProperties = findNetworkAddress(process.env.PREFERRED_NETWORK_INTERFACE || config.apiService.networkInterface);

    networkProperties.networkAddress = process.env.HOST_NETWORK_ADDRESS || networkProperties.networkAddress;

    config.apiService = readHostProperties(config.apiService, networkProperties);

    config.managementService.host = process.env.PIPELINE_API_HOST || config.managementService.host;
    config.managementService.port = parseInt(process.env.PIPELINE_API_PORT) || config.managementService.port;

    config.messageService.host = process.env.PIPELINE_MESSAGE_HOST || config.messageService.host;
    config.messageService.port = parseInt(process.env.PIPELINE_MESSAGE_PORT) || config.messageService.port;

    return config;
}

let localServerConfiguration = null;

export function ServerConfiguration(): IServerConfig {
    if (localServerConfiguration === null) {
        localServerConfiguration = overrideDefaults(configurations.production);
    }

    return localServerConfiguration;
}

interface INetworkProperties {
    interfaceName: string;
    networkAddress: string;
}

function readHostProperties(config: IApiServiceConfiguration, networkProperties: INetworkProperties): IApiServiceConfiguration {
    return {
        name: process.env.PIPELINE_WORKER_NAME || os.hostname(),
        networkInterface: networkProperties.interfaceName,
        networkAddress: networkProperties.networkAddress,
        networkPort: parseInt(process.env.PIPELINE_WORKER_API_PORT) || config.networkPort,
        graphQlEndpoint: config.graphQlEndpoint,
        graphiQlEndpoint: config.graphiQlEndpoint
    };
}

function findNetworkAddress(preferredNetworkInterface: string): INetworkProperties {
    let networkProperties: INetworkProperties = {
        interfaceName: "",
        networkAddress: ""
    };

    let interfaces = os.networkInterfaces();

    if (preferredNetworkInterface.length > 0 && interfaces[preferredNetworkInterface] != null) {
        interfaces[preferredNetworkInterface].forEach(networkAddress => {
            if (networkAddress.family === "IPv4" && !networkAddress.internal) {
                networkProperties.interfaceName = preferredNetworkInterface;
                networkProperties.networkAddress = networkAddress.address;
            }
        });
    }

    for (let networkInterface in interfaces) {
        if (networkProperties.interfaceName.length !== 0) {
            break;
        }

        interfaces[networkInterface].forEach(networkAddress => {
            if (networkProperties.interfaceName.length === 0 && networkAddress.family === "IPv4" && !networkAddress.internal) {
                networkProperties.interfaceName = networkInterface;
                networkProperties.networkAddress = networkAddress.address;
            }
        });
    }

    if (networkProperties.interfaceName.length === 0) {
        debug("failed to find network address");
    }

    return networkProperties;
}
