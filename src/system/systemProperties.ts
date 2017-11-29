const os = require("os");

export interface IIMachineProperties {
    osType: string;
    platform: string;
    arch: string;
    release: string;
    cpuCount: number;
    totalMemory: number;
}

const machineProperties = {
    osType: "",
    platform: "",
    arch: "",
    release: "",
    cpuCount: 0,
    totalMemory: 0
};


function readMachineProperties(): IIMachineProperties {
    return {
        osType: os.type(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem()
    };
}
