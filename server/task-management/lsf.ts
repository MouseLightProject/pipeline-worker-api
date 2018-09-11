import {exec} from "child_process";

const debug = require("debug")("pipeline:worker-api:lsf");

import {JobStatus, IJobUpdate} from "./taskSupervisor";
import {isNull} from "util";
import {ServiceConfiguration} from "../options/serviceConfig";

const clusterHost = ServiceConfiguration.cluster.submitHost;

enum JobAttributes {
    JobId = "JOBID",
    User = "USER",
    Status = "STAT",
    Queue = "QUEUE",
    ExitCode = "EXIT_CODE",
    FromHost = "FROM_HOST",
    ExecHost = "EXEC_HOST",
    JobName = "JOB_NAME",
    SubmitTime = "SUBMIT_TIME",
    ProjectName = "PROJ_NAME",
    CpuUsed = "CPU_USED",
    MemoryUsed = "MEM",
    Swap = "SWAP",
    ProcessIds = "PIDS",
    StartTime = "START_TIME",
    FinishTime = "FINISH_TIME",
    Slots = "SLOTS"
}

const statusMap = new Map<string, JobStatus>();

function StatusMap() {
    if (statusMap.size === 0) {
        statusMap.set("PEND", JobStatus.Pending);
        statusMap.set("RUN", JobStatus.Online);
        statusMap.set("DONE", JobStatus.Stopped);
        statusMap.set("EXIT", JobStatus.Exited);
    }

    return statusMap;
}

function parseJobInfoOutput(output: string): IJobUpdate[] {
    const map = StatusMap();

    try {
        const lines = output.split("\n");

        const header = lines.shift();

        const columns = header.split(" ").map(c => c.trim()).filter(c => c.length > 0);

        const jobs = lines.filter(line => line.length > 0).map(line => {
            const jobInfo: IJobUpdate = {
                id: null,
                status: JobStatus.Unknown,
                exitCode: null,
                statistics: {
                    cpuPercent: null,
                    cpuTimeSeconds: null,
                    memoryMB: null,
                }
            };

            const parts = line.split(" ").map(c => c.trim()).filter(c => c.length > 0);

            if (parts.length !== columns.length) {
                console.log(`parts and columns lengths do not match`);
                return jobInfo;
            }

            columns.map((c, idx) => {
                switch (c) {
                    case JobAttributes.JobId:
                        jobInfo.id = parseInt(parts[idx]);
                        break;
                    case JobAttributes.Status:
                        if (map.has(parts[idx])) {
                            jobInfo.status = map.get(parts[idx]);
                        } else {
                            console.log(`didn't find status :${parts[idx]}: in map.`)
                        }
                        break;
                    case JobAttributes.ExitCode:
                        jobInfo.exitCode = parseInt(parts[idx]);
                        break;
                    case JobAttributes.MemoryUsed:
                        jobInfo.statistics.memoryMB = parseInt(parts[idx]);
                        break;
                    case JobAttributes.CpuUsed:
                        jobInfo.statistics.cpuTimeSeconds = parseCpuUsed(parts[idx]);
                        break;
                }
            });

            return jobInfo;
        });

        return jobs.filter(j => !isNull(j.id));
    } catch (err) {
        debug(err);
        return [];
    }
}

function parseCpuUsed(value: string): number {
    try {
        // momentjs doesn't help with triple digit hours format: hhh:mm:ss.sss
        const parts = value.split(":");

        if (parts.length === 3) {
            const hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseFloat(parts[2]);

            return (hours * 3600) + (minutes * 60) + seconds;
        } else {
            return 0;
        }
    } catch (ex) {
        return 0;
    }
}

export function updateJobInfo(jobArray: string[]): Promise<IJobUpdate[]> {
    return new Promise<IJobUpdate[]>((resolve, reject) => {
        try {
            /*
            let response = "";

            const queueStatus = spawn("ssh", [clusterHost, `"bjobs -d -W ${jobArray.join("")}"`]);

            queueStatus.stdout.on("data", (data) => {
                response += data;
            });

            queueStatus.on("close", (code) => {
                console.log(response);
                resolve(parseJobInfoOutput(response));
            });
            */

            exec(`ssh ${clusterHost} "bjobs -a -W ${jobArray.join(" ")}"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
                if (error) {
                    debug(error);
                    reject([]);
                } else {
                    // console.log(stdout);
                    resolve(parseJobInfoOutput(stdout));
                }
            });

        } catch (err) {
            debug(err);
            reject([]);
        }
    });
}

export function killJob(jobId: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            exec(`ssh ${clusterHost} "bkill ${jobId}"`, {maxBuffer: 10000}, (err, stdout, stderr) => {
                if (err) {
                    debug(err);
                    reject();
                } else {
                    console.log(stdout);
                    resolve();
                }
            });

        } catch (err) {
            debug(err);
            reject();
        }
    });
}
