const os = require("os");

const debug = require("debug")("pipeline:worker-api:configuration");

export interface IApiService {
    name: string;
    networkInterface: string;
    networkAddress: string;
    networkPort: number;
    graphQlEndpoint: string;
    graphiQlEndpoint: string;
}

const ApiService: IApiService = {
    name: "",
    networkInterface: "",
    networkAddress: "",
    networkPort: 6201,
    graphQlEndpoint: "/graphql",
    graphiQlEndpoint: "/graphiql"
};

function loadApiService(apiService: IApiService): IApiService {
    let networkProperties: INetworkProperties = findNetworkAddress(process.env.PREFERRED_NETWORK_INTERFACE || apiService.networkInterface);

    networkProperties.networkAddress = process.env.HOST_NETWORK_ADDRESS || networkProperties.networkAddress;

    return readHostProperties(apiService, networkProperties);
}

interface INetworkProperties {
    interfaceName: string;
    networkAddress: string;
}

function readHostProperties(config: IApiService, networkProperties: INetworkProperties): IApiService {
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

export const ServiceConfiguration = loadApiService(ApiService);
