import {exec} from "child_process";
import {ExecutionStatus, IProcessId} from "./taskSupervisor";

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

const statusMap = new Map<string, ExecutionStatus>();

function StatusMap() {
    if (statusMap.size === 0) {
        statusMap.set("PEND", ExecutionStatus.Pending);
        statusMap.set("RUN", ExecutionStatus.Online);
        statusMap.set("DONE", ExecutionStatus.Stopped);
        statusMap.set("EXIT", ExecutionStatus.Exited);
    }

    return statusMap;
}

function parseJobInfoOutput(output: string): IProcessId[] {
    const map = StatusMap();

    const lines = output.split("\n");

    const header = lines.shift();

    const columns = header.split(" ").map(c => c.trim()).filter(c => c.length > 0);

    const jobs = lines.filter(line => line.length > 0).map(line => {
        const jobInfo: IProcessId = {
            id: null,
            status: ExecutionStatus.Unknown,
            exitCode: null
        };

        const parts = line.split(" ");

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
            }
        });

        return jobInfo
    });

    return jobs;
}

export function updateJobInfo(jobArray: string[] = []): Promise<IProcessId[]> {
    return new Promise<IProcessId[]>((resolve, reject) => {
        try {
            /*
            let response = "";

            const queueStatus = spawn("ssh", ["login1", `"bjobs -d -W ${jobArray.join("")}"`]);

            queueStatus.stdout.on("data", (data) => {
                response += data;
            });

            queueStatus.on("close", (code) => {
                console.log(response);
                resolve(parseJobInfoOutput(response));
            });
            */

            exec(`ssh login1 "bjobs -d -W ${jobArray.join("")}"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
                if (error) {
                    console.log(error);
                } else {
                    resolve(parseJobInfoOutput(stdout));
                }
            });

        } catch (err) {
            console.log(err);
            reject([]);
        }
    });
}
