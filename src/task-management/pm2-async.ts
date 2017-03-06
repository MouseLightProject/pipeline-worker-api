import * as pm2 from "pm2";

const debug = require("debug")("mouselight:worker-api:pm2");

export enum ExecutionMode {
    Unknown = 0,
    Fork = 1,
    Cluster = 2,
    Undefined = 3
}

export enum ExecutionStatus {
    Undefined = -1,
    Unknown = 0,
    Started = 1,
    Online = 2,
    Restarted = 3,
    RestartOverLimit = 4,
    Stopping = 5,
    Stopped = 6,
    Exited = 7,
    Deleted = 8
}

export interface IProcessInfo {
    name: string;
    managerId: number;
    processId: number;
    mode: ExecutionMode;
    status: ExecutionStatus;
    memory: number;
    cpu: number;
    interpreter: string;
    scriptPath: string;
    exitCode: number;
}

export interface IPM2MonitorDelegate {
    processEvent(name: string, processInfo: IProcessInfo, manually: boolean);
    pm2Killed();
}

export function connect(noDaemonMode: boolean = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        pm2.connect(noDaemonMode, (err) => {
            if (err) {
                reject(err);
            } else {
                debug("daemon launched/connected.");
                resolve();
            }
        });
    });
}

export function monitor(delegate: IPM2MonitorDelegate = null): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        pm2.launchBus((err, bus) => {
            let localDelegate = delegate;

            if (err) {
                reject(err);
                return;
            }

            bus.on("process:event", (evt) => {
                // debug(`process:event "${evt.event}" for ${evt.process.name} (manual: ${evt.manually})`);

                if (localDelegate) {
                    let processInfo = _mapProcessInfo(evt.process);
                    localDelegate.processEvent(evt.event, processInfo, evt.manually);
                }
            });

            bus.on("pm2:kill", (evt) => {
                debug(`pm2:kill event`);
                if (localDelegate) {
                    localDelegate.pm2Killed();
                }
            });

            debug("bus monitoring enabled.");

            resolve();
        });
    });
}

export function start(options): Promise<IProcessInfo> {
    return new Promise<IProcessInfo>((resolve, reject) => {
        pm2.start(options, (err, processList) => {
            if (err) {
                debug(err);
                reject(err);
            } else {
                // debug(`start() returned ${processList.length} process description`);

                if (processList.length > 0) {
                    resolve(_mapProcessInfo(processList[0].pm2_env));
                } else {
                    reject("start() returned empty process array");
                }
            }
        });
    });
}

export function stop(options): Promise<IProcessInfo> {
    return new Promise<IProcessInfo>((resolve, reject) => {
        pm2.stop(options, (err, processInfo) => {
            if (err) {
                debug(err);
                reject(err);
            } else {
                debug(`stopped process`);
                let result = _mapProcessInfo(processInfo);
                resolve(result);
            }
        });
    });
}

export function list(): Promise<IProcessInfo[]> {
    return new Promise<IProcessInfo[]>((resolve, reject) => {
        pm2.list((err, processList) => {
            if (err) {
                debug(err);
                reject(err);
            } else {
                // debug(`list() returned ${processList.length} process descriptions`);
                let result: IProcessInfo[] = [];
                processList.forEach((processInfo) => {
                    result.push(_mapProcessInfo(processInfo.pm2_env, processInfo.monit, processInfo.pid));
                });
                resolve(result);
            }
        });
    });
}

export function describe(pid: number): Promise<IProcessInfo> {
    return new Promise<IProcessInfo>((resolve, reject) => {
        try {
            pm2.describe(pid, (err, processList) => {
                if (err) {
                    debug(err);
                    reject(err);
                } else {
                    // debug(`describe returned ${processList.length} process descriptions`);
                    if (processList && processList.length > 0) {
                        let result = _mapProcessInfo(processList[0].pm2_env, processList[0].monit, processList[0].pid);
                        console.log(result);
                    } else {
                        reject(`PM2 describe(${pid}) returned process info of length 0.`);
                    }
                }
            });
        } catch (err) {
            debug(err);
            console.log(err);
            reject(err);
        }
    });
}

export function sendSignalToProcessName(signal: string, pid: any): Promise<IProcessInfo[]> {
    return new Promise<IProcessInfo[]>(async(resolve, reject) => {
        let processInfo = await describe(pid);
        pm2.sendSignalToProcessName(signal, processInfo.name, (err, processList) => {
            if (err) {
                debug(err);
                reject(err);
            } else {
                debug(`${signal} sent to ${pid}`);
                let result: IProcessInfo[] = [];
                processList.forEach((processInfo) => {
                    result.push(_mapProcessInfo(processInfo));
                });
                resolve(result);
            }
        });
    });
}

export function deleteTask(pid: any): Promise<IProcessInfo[]> {
    return new Promise<IProcessInfo[]>((resolve, reject) => {
        pm2.delete(pid, (err, processList) => {
            if (err) {
                debug(err);
                reject(err);
            } else {
                // debug(`delete returned ${processList.length} process descriptions`);
                let result: IProcessInfo[] = [];
                processList.forEach((processInfo) => {
                    result.push(_mapProcessInfo(processInfo.pm2_env));
                });
                resolve(result);
            }
        });
    });
}

function _mapProcessInfo(pm2env, mon = {memory: null, cpu: null}, pid = null): IProcessInfo {
    if (!pm2env) {
        return null;
    }

    return {
        name: pm2env.name,
        managerId: pm2env.pm_id,
        processId: pid,
        mode: _lookupExecMode(pm2env.exec_mode),
        status: _lookupExecStatus(pm2env.status),
        memory: mon.memory,
        cpu: mon.cpu,
        interpreter: pm2env.exec_interpreter,
        scriptPath: pm2env.pm_exec_path,
        exitCode: pm2env.exit_code != null ? pm2env.exit_code : null
    };
}

function _lookupExecMode(str: string): ExecutionMode {
    if (str === "fork_mode") {
        return ExecutionMode.Fork;
    } else if (str === "cluster_mode") {
        return ExecutionMode.Cluster;
    } else if (str === "undefined" || !str) {
        return ExecutionMode.Undefined;
    } else {
        console.log(`Unexpected PM2 execution mode string (${str}).`);
        return ExecutionMode.Undefined;
    }
}

function _lookupExecStatus(str: string): ExecutionStatus {
    if (str === "start") {
        return ExecutionStatus.Started;
    } else if (str === "online") {
        return ExecutionStatus.Online;
    } else if (str === "restart") {
        return ExecutionStatus.Restarted;
    } else if (str === "restart overlimit") {
        return ExecutionStatus.RestartOverLimit;
    } else if (str === "stopping") {
        return ExecutionStatus.Stopping;
    } else if (str === "stopped") {
        return ExecutionStatus.Stopped;
    } else if (str === "exit") {
        return ExecutionStatus.Exited;
    } else if (str === "delete") {
        return ExecutionStatus.Deleted;
    } else if (str === "undefined") {
        return ExecutionStatus.Undefined;
    } else {
        console.log(`Unexpected PM2 execution status string (${str}).`);
        return null;
    }
}
