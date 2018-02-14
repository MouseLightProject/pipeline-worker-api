import {isNullOrUndefined} from "util";
import * as moment from "moment";
import * as _ from "lodash";

const ChildProcess = require("child_process");
import * as ProcessManager from "./pm2-async";

const debug = require("debug")("pipeline:worker-api:local-manager");

import {IProcessInfo} from "./pm2-async";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {ExecutionStatus, ITaskExecution} from "../data-model/sequelize/taskExecution";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {
    JobStatus, IJobStatistics, ITaskUpdateDelegate,
    ITaskUpdateSource, ITaskManager, QueueType
} from "./taskSupervisor";

export class LocalTaskManager implements ITaskUpdateSource, ITaskManager, ProcessManager.IPM2MonitorDelegate {
    private _localStorageManager: LocalPersistentStorageManager = LocalPersistentStorageManager.Instance();

    private _taskUpdateDelegate: ITaskUpdateDelegate;

    public async connect() {
        await ProcessManager.connect();

        await ProcessManager.monitor(this);

        // Occasionally look for anything not captured through PM2 events.
        setTimeout(async () => {
            await this.refreshAllTasks();
        }, 0);
    }

    public get TaskUpdateDelegate(): ITaskUpdateDelegate {
        return this._taskUpdateDelegate;
    }

    public set TaskUpdateDelegate(delegate: ITaskUpdateDelegate) {
        this._taskUpdateDelegate = delegate;
    }

    public async processEvent(name: string, processInfo: IProcessInfo, manually: boolean): Promise<void> {
        return this.refreshOneTaskForProcess(processInfo);
    }

    public pm2Killed() {
        debug("pm2 delegate acknowledge kill event");
    }

    private async refreshAllTasks() {
        try {
            await this.refreshTasksFromProcessManager();
        } catch (err) {
            debug(err);
        }

        setTimeout(() => this.refreshAllTasks(), 60 * 1000);
    }

    // TODO Need a function to refresh what the database thinks are running tasks (find orphans, update stats, etc).
    // Should it be merged with refreshing the list from the process manager?  If we are only going to start through
    // this interface than the only ones that should exist that we"d care about should be known to us, unless there is
    // a bug where a process gets kicked off, but the initial save to database fails at creation.

    private async refreshTasksFromProcessManager() {
        const processList: IProcessInfo[] = await ProcessManager.list();

        const running: ITaskExecution[] = (await this._localStorageManager.TaskExecutions.findRunning()).filter(z => z.queue_type === QueueType.Local);

        if (running.length === 0) {
            // TODO if refreshOneTaskForProcess starts doing something with orphans, don't early return here.
            debug("No running jobs - skipping local status check.");
            return;
        }

        await Promise.all(processList.map(processInfo => this.refreshOneTaskForProcess(processInfo)));

        const zombies = _.differenceWith(running, processList, (r: ITaskExecution, j: IProcessInfo) => {
            return r.id === j.name;
        });

        await Promise.all(zombies.filter(z => z.queue_type === QueueType.Local).map(async (o) => {
            // Only after 15 minutes in case there is any delay between submission and when the job is first
            // available in polling.
            if (Date.now().valueOf() - o.started_at.valueOf() > 15 * 60 * 1000) {
                await this.TaskUpdateDelegate.updateZombie(o);
            }
        }));

        const longRunning = running.map(r => moment.duration(Date.now().valueOf() - r.started_at.valueOf())).filter(d => d.asSeconds() > 60).sort((a, b) => b.asMilliseconds() - a.asMilliseconds());

        if (longRunning.length > 0) {
            debug(`${longRunning.length} local tasks have been running longer than 1 minute`);
            debug(`\tlongest ${longRunning[0].humanize()}`);
            if (longRunning.length > 1) {
                debug(`\lshortest ${longRunning[longRunning.length - 1].humanize()}`);
            }
        }
    }

    private async refreshOneTaskForProcess(processInfo: IProcessInfo): Promise<void> {
        const taskExecution = await this._localStorageManager.TaskExecutions.findById(processInfo.name);

        if (taskExecution) {
            let stats = null;

            if (processInfo.processId && processInfo.processId > 0) {
                try {
                    stats = await readProcessStatistics(processInfo.processId);
                } catch (err) {
                    debug(err);
                }
            }

            if (this.TaskUpdateDelegate) {
                await this.TaskUpdateDelegate.update(taskExecution, {
                    id: processInfo.processId,
                    status: processInfo.status,
                    exitCode: processInfo.exitCode,
                    statistics: stats
                });
            }

            if (taskExecution.execution_status_code === ExecutionStatus.Completed && processInfo.status === JobStatus.Stopped) {
                debug(`removing completed process (${processInfo.managerId}) from process manager`);
                await ProcessManager.deleteTask(processInfo.managerId);
            }
        } else {
            // TODO orphaned process.
        }
    }

    public async startTask(taskExecution: ITaskExecution, taskDefinition: ITaskDefinition) {
        let opts = {
            name: taskExecution.id,
            script: taskExecution.resolved_script,
            args: taskExecution.resolved_script_arg_array,
            interpreter: taskDefinition.interpreter,
            exec_mode: "fork",
            autorestart: false,
            watch: false,
            output: taskExecution.resolved_log_path + ".local.out.log",
            error: taskExecution.resolved_log_path + ".local.err.log"
        };

        await ProcessManager.start(opts);
    }

    public async stopTask(taskExecutionId: string) {
        try {
            await ProcessManager.stop(taskExecutionId);
        } catch (err) {
            debug(err);
        }
    }
}

export const localTaskManager = new LocalTaskManager();

localTaskManager.connect().catch(err => {
    debug("failed to connect to process manager from graphql context.");
});

function readProcessStatistics(processId): Promise<IJobStatistics> {
    return new Promise<IJobStatistics>((resolve, reject) => {
        ChildProcess.exec(`ps -A -o pid,pgid,rss,%cpu | grep ${processId}`, (err, stdout, stderr) => {
            if (err || stderr) {
                reject(err);
            }
            else {
                let stats: IJobStatistics = {
                    cpuPercent: null,
                    cpuTime: null,
                    memoryGB: null,
                };

                stdout = stdout.split(/\n/).filter(Boolean);

                let statsArray: Array<IJobStatistics> = stdout.map(obj => {
                    let parts = obj.split(/[\s+]/).filter(Boolean);

                    if (parts && parts.length === 4) {
                        return {
                            cpuPercent: parseFloat(parts[3]),
                            cpuTime: null,
                            memoryGB: parseInt(parts[2]) / 1024 / 1024
                        };
                    } else {
                        return null;
                    }
                }).filter(Boolean);

                stats = statsArray.reduce((prev, stats) => {
                    return {
                        cpuPercent: isNullOrUndefined(prev.cpuPercent) ? stats.cpuPercent : prev.cpuPercent + stats.cpuPercent,
                        cpuTime: null,
                        memoryGB: isNullOrUndefined(prev.memoryGB) ? stats.memoryGB : prev.memoryGB + stats.memoryGB
                    };
                }, stats);

                resolve(stats);
            }
        });
    });
}
