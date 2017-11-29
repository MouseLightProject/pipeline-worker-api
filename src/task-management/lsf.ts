const exec = require("child_process").exec;

enum JobAttributes {
    JobId = "JOBID",
    User = "USER",
    Status = "STAT",
    Queue = "QUEUE",
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

export class JobInformation {

}

updateJobInfo();

function parseJobInfoOutput(output: string) {
    const lines = output.split("\n");

    console.log(lines.length);
}

function updateJobInfo(jobArray: string[] = []) {
    exec(`ssh login1 "bjobs -d -W -noheader ${jobArray.join("")}"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
        } else {
            parseJobInfoOutput(stdout);
        }
    });
}
