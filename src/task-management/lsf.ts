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
    private _jobId: number;

    public get JobId() {
        return this._jobId;
    }

    public set JobId(id: number) {
        this._jobId = id;
    }
}

updateJobInfo();

function parseJobInfoOutput(output: string) {
    const lines = output.split("\n");

    const header = lines.shift();

    const columns = header.split(" ");

    const jobs = lines.map(line => {
        const jobInfo = new JobInformation();

        const parts = line.split(" ");

        columns.map((c, idx) =>{
            switch (c) {
                case JobAttributes.JobId:
                    jobInfo.JobId = parseInt(parts[idx]);
                    break;
            }
        });

        return jobInfo
    });

    console.log(jobs[0]);

    console.log(jobs);
}

function updateJobInfo(jobArray: string[] = []) {
    exec(`ssh login1 "bjobs -d -W ${jobArray.join("")}"`, {maxBuffer: 10000 * 400}, (error, stdout, stderr) => {
        if (error) {
            console.log(error);
        } else {
            parseJobInfoOutput(stdout);
        }
    });
}
