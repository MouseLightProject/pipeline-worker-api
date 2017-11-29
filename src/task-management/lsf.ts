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

function updateJobInfo() {
    exec(`ssh login1 "bjobs -d -W -noheader"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
        } else {
            console.log(stdout);
        }
    });
}
