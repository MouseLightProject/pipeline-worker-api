import {spawn} from "child_process";
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

const StatusMap = new Map<string, ExecutionStatus>();

StatusMap.set("PEND", ExecutionStatus.Pending);
StatusMap.set("RUN", ExecutionStatus.Online);
StatusMap.set("DONE", ExecutionStatus.Stopped);
StatusMap.set("EXIT", ExecutionStatus.Exited);

function parseJobInfoOutput(output: string): IProcessId[] {
    const lines = output.split("\n");

    const header = lines.shift();

    const columns = header.split(" ");

    const jobs = lines.map(line => {
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
                    if (StatusMap.has(parts[idx])) {
                        jobInfo.status = StatusMap.get(parts[idx]);
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
            let response = "";

            const queueStatus = spawn("ssh", ["login1", `"bjobs -d -W ${jobArray.join("")}"`]);

            queueStatus.stdout.on("data", (data) => {
                response += data;
            });

            queueStatus.on("close", (code) => {
                resolve(parseJobInfoOutput(response));
            });
        } catch (err) {
            console.log(err);
            reject([]);
        }
    });

    /*
    exec(`ssh login1 "bjobs -d -W ${jobArray.join("")}"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
        } else {
            parseJobInfoOutput(stdout);
        }
    });
    */
}
