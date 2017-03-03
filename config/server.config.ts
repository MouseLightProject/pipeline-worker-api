const os = require("os");

const debug = require("debug")("mouselight:worker-api:configuration");

import {IConfiguration} from "./configuration";

export interface IIMachineProperties {
    osType: string;
    platform: string;
    arch: string;
    release: string;
    cpuCount: number;
    totalMemory: number;
    freeMemory: number;
    loadAverage: number;
}

export interface IApiServiceConfiguration {
    machineId: string;
    name: string;
    networkInterface: string;
    networkAddress: string;
    networkPort: number;
    graphQlEndpoint: string;
    graphiQlEndpoint: string;
    workUnitCapacity: number;
    isClusterProxy: boolean;
    machineProperties: IIMachineProperties;
}

// To establish socket.io, graphql, and any other connections.  In place of having a general discovery service.

export interface IManagementServiceConfiguration {
    host: string;
    port: number;
    graphQLEndpoint: string;
}
export interface IServerConfig {
    apiService: IApiServiceConfiguration;
    managementService: IManagementServiceConfiguration;
}

const configurations: IConfiguration<IServerConfig> = {
    development: {
        apiService: {
            machineId: "1bcc812d-97ce-4b14-ad48-5c3c9b9b416e",
            name: "",
            networkInterface: "",
            networkAddress: "",
            networkPort: 3001,
            graphQlEndpoint: "/graphql",
            graphiQlEndpoint: "/graphiql",
            workUnitCapacity: 4,
            isClusterProxy: false,
            machineProperties: {
                osType: "",
                platform: "",
                arch: "",
                release: "",
                cpuCount: 0,
                totalMemory: 0,
                freeMemory: 0,
                loadAverage: 0,
            }
        },
        managementService: {
            host: "localhost",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    },
    test: {
        apiService: {
            machineId: "",
            name: "",
            networkInterface: "",
            networkAddress: "",
            networkPort: 3001,
            graphQlEndpoint: "/graphql",
            graphiQlEndpoint: "/graphiql",
            workUnitCapacity: 2,
            isClusterProxy: false,
            machineProperties: {
                osType: "",
                platform: "",
                arch: "",
                release: "",
                cpuCount: 0,
                totalMemory: 0,
                freeMemory: 0,
                loadAverage: 0,
            }
        },
        managementService: {
            host: "localhost",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    },
    staging: {
        apiService: {
            machineId: "",
            name: "",
            networkInterface: "",
            networkAddress: "",
            networkPort: 3051,
            graphQlEndpoint: "/graphql",
            graphiQlEndpoint: "/graphiql",
            workUnitCapacity: 2,
            isClusterProxy: false,
            machineProperties: {
                osType: "",
                platform: "",
                arch: "",
                release: "",
                cpuCount: 0,
                totalMemory: 0,
                freeMemory: 0,
                loadAverage: 0,
            }
        },
        managementService: {
            host: "localhost",
            port: 3050,
            graphQLEndpoint: "/graphql"
        }
    },
    production: {
        apiService: {
            machineId: "",
            name: "",
            networkInterface: "",
            networkAddress: "",
            networkPort: 3001,
            graphQlEndpoint: "/graphql",
            graphiQlEndpoint: "/graphiql",
            workUnitCapacity: 2,
            isClusterProxy: false,
            machineProperties: {
                osType: "",
                platform: "",
                arch: "",
                release: "",
                cpuCount: 0,
                totalMemory: 0,
                freeMemory: 0,
                loadAverage: 0,
            }
        },
        managementService: {
            host: "localhost",
            port: 3000,
            graphQLEndpoint: "/graphql"
        }
    }
};

function overrideDefaults(config: IServerConfig): IServerConfig {
    let preferredNetworkInterface = process.env.PREFERRED_NETWORK_INTERFACE || config.apiService.networkInterface;

    config.apiService = readHostProperties(config.apiService, preferredNetworkInterface);

    config.apiService.machineProperties = readMachineProperties();


    config.managementService.host = process.env.SERVER_HOST || config.managementService.host;
    config.managementService.port = process.env.SERVER_PORT || config.managementService.port;

    if (config.apiService.machineId.length === 0) {
        throw new Error("machine id must be set");
    }

    return config;
}

let localServerConfiguration = null;

export default function readServerConfiguration(): IServerConfig {
    if (localServerConfiguration === null) {
        let env = process.env.NODE_ENV || "development";

        localServerConfiguration = overrideDefaults(configurations[env]);
    }

    return localServerConfiguration;
}

interface INetworkProperties {
    interfaceName: string;
    networkAddress: string;
}

function readHostProperties(config: IApiServiceConfiguration, preferredNetworkInterface: string): IApiServiceConfiguration {
    let networkProperties: INetworkProperties = findNetworkAddress(preferredNetworkInterface);

    return {
        machineId: process.env.MACHINE_ID || config.machineId,
        name: os.hostname(),
        networkInterface: networkProperties.interfaceName,
        networkAddress: networkProperties.networkAddress,
        networkPort: process.env.PORT || config.networkPort,
        graphQlEndpoint: config.graphQlEndpoint,
        graphiQlEndpoint: config.graphiQlEndpoint,
        workUnitCapacity: process.env.WORK_UNIT_CAPACITY || config.workUnitCapacity,
        isClusterProxy: process.env.IS_CLUSTER_PROXY || config.isClusterProxy,
        machineProperties: config.machineProperties
    };
}

function readMachineProperties(): IIMachineProperties {
    return {
        osType: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        cpuCount: os.cpus().length,
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        loadAverage: os.loadavg()
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
