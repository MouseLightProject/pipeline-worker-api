import * as pm2 from "pm2";
import {JobStatus} from "./taskSupervisor";

const debug = require("debug")("pipeline:worker-api:pm2");

export enum ExecutionMode {
    Unknown = 0,
    Fork = 1,
    Cluster = 2,
    Undefined = 3
}

export interface IProcessInfo {
    name: string;
    managerId: number;
    processId: number;
    mode: ExecutionMode;
    status: JobStatus;
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
                    resolve(_mapProcessInfo(processList[0].pm2_env, {memory: null, cpu: null}, processList[0].pid));
                } else {
                    reject("start() returned empty process array");
                }
            }
        });
    });
}

export function stop(options): Promise<IProcessInfo> {
    return new Promise<IProcessInfo>((resolve, reject) => {
        pm2.describe(options, (err, processDescription) => {
            if (err) {
                debug(err);
                reject(null);
            }
            pm2.stop(options, (err, processInfo) => {
                if (err) {
                    debug(err);
                    reject(null);
                } else {
                    debug(`stopped process`);
                    let result = _mapProcessInfo(processInfo);
                    resolve(result);
                }
            });
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
                if (err.message.toLocaleLowerCase() !== "process not found") {
                    debug(err);
                    reject(err);
                }
                resolve(null);
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
        return ExecutionMode.Undefined;
    }
}

function _lookupExecStatus(str: string): JobStatus {
    if (str === "start") {
        return JobStatus.Started;
    } else if (str === "online") {
        return JobStatus.Online;
    } else if (str === "restart") {
        return JobStatus.Restarted;
    } else if (str === "restart over limit") {
        return JobStatus.RestartOverLimit;
    } else if (str === "stopping") {
        return JobStatus.Stopping;
    } else if (str === "stopped") {
        return JobStatus.Stopped;
    } else if (str === "exit") {
        return JobStatus.Exited;
    } else if (str === "delete") {
        return JobStatus.Deleted;
    } else if (str === "undefined") {
        return JobStatus.Undefined;
    } else {
        return JobStatus.Undefined;
    }
}
