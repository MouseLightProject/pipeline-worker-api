import {
    CompletionStatusCode, ExecutionStatusCode, ITaskExecution,
    SyncStatus
} from "../data-model/sequelize/taskExecution";
import {RemotePersistentStorageManager} from "./remote/databaseConnector";
import * as _ from "lodash";
import {LocalPersistentStorageManager} from "./local/databaseConnector";

const debug = require("debug")("pipeline:worker-api:synchronize");

let workerId = process.argv.length > 2 ? process.argv[2] : null;
let completionCode = process.argv.length > 3 ? process.argv[3] : null;

const remoteStorageManager = RemotePersistentStorageManager.Instance();
const localStorageManager = LocalPersistentStorageManager.Instance();

if (workerId && completionCode) {
    runAsIndependentTask(workerId, parseInt(completionCode));
}

function runAsIndependentTask(workerId: string, completionCode: CompletionStatusCode) {
    if (!localStorageManager.IsConnected || !remoteStorageManager.IsConnected) {
        debug("one or both databases not connected");
        setTimeout(() => runAsIndependentTask(workerId, completionCode), 1000);
        return;
    }

    synchronizeTaskExecutions(workerId, completionCode).then((result) => {
        if (result) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    }).catch((err) => {
        console.error(err);
        process.exit(2);
    });
}

export async function watchdogInProgressSync(workerId: string) {
    const tenMinutesAgo = new Date();

    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const suspects = await localStorageManager.TaskExecutions.findAll({
        where: {
            sync_status: SyncStatus.InProgress,
            synchronized_at: {$lt: tenMinutesAgo}
        }
    });

    await Promise.all(suspects.map(s => {
        s.sync_status = SyncStatus.Never;
        return s.save();
    }));
}

export async function synchronizeTaskExecutions(workerId: string, completionCode: CompletionStatusCode, isFork = false) {
    try {
        await watchdogInProgressSync(workerId);

        // The array of all local failed, or canceled, etc tasks independent of sync status
        const local = await localStorageManager.TaskExecutions.findAll({
            where: {
                execution_status_code: ExecutionStatusCode.Completed,
                completion_status_code: completionCode
            }
        });

        const localUnSynced = local.filter(t => t.sync_status === SyncStatus.Never || t.sync_status === SyncStatus.Expired);

        // The array of all remote associated with this worker and completion code.
        const remote = await remoteStorageManager.TaskExecutions.findAll({
            where: {
                // id: {$in: local.map(t => t.id)}
                worker_id: workerId,
                completion_status_code: completionCode
            }
        });

        const inserting = _.differenceBy<ITaskExecution>(localUnSynced, remote, "id");

        if (inserting.length > 0) {
            debug(`inserting ${inserting.length} ${completionCode} task execution(s)`);

            await setSyncStatus(inserting, SyncStatus.InProgress);

            await insertRemote(inserting);

            await setSyncStatus(inserting, SyncStatus.Complete);
        }

        const updating = _.intersectionBy(localUnSynced, remote, "id");

        if (updating.length > 0) {
            debug(`updating ${updating.length} ${completionCode} task execution(s)`);

            await setSyncStatus(updating, SyncStatus.InProgress);

            await updateRemote(updating);

            await setSyncStatus(updating, SyncStatus.Complete);
        }

        // Anything on the remote system that no longer exists locally.
        const removing = _.differenceBy<ITaskExecution>(remote, local, "id");

        if (removing.length > 0) {
            debug(`removing ${removing.length} ${completionCode} task execution(s)`);

            await removeRemote(removing);
        }
    }
    catch (err) {
        debug(err);
        return false;
    }

    return true;
}

async function setSyncStatus(tasks: ITaskExecution[], syncStatus: SyncStatus) {
    await localStorageManager.Connection.transaction(t => {
        return Promise.all(tasks.map(task => {
            task.sync_status = syncStatus;

            if (syncStatus === SyncStatus.Complete) {
                task.synchronized_at = new Date();
            }

            return task.save({transaction: t});
        }))
    });
}

async function insertRemote(tasks: ITaskExecution[]) {
    await remoteStorageManager.Connection.transaction(t => {
        return Promise.all(tasks.map(task => {
            const obj = task.get({plain: true});

            obj.sync_status = SyncStatus.Never;
            obj.synchronized_at = null;

            return remoteStorageManager.TaskExecutions.create(obj, {transaction: t});
        }))
    });
}

async function updateRemote(tasks: ITaskExecution[]) {
    await remoteStorageManager.Connection.transaction(t => {
        return Promise.all(tasks.map(async (task) => {
            const obj = task.get({plain: true});

            const remote = await remoteStorageManager.TaskExecutions.findById(obj.id);

            if (remote.synchronized_at === null) {
                obj.sync_status = SyncStatus.Never;
            } else {
                obj.sync_status = SyncStatus.Expired;
            }

            if (obj.sync_status !== remote.sync_status) {
                return remote.update(obj, {transaction: t});
            } else {
                return Promise.resolve();
            }
        }));
    });
}

async function removeRemote(tasks: ITaskExecution[]) {
    await remoteStorageManager.Connection.transaction(t => {
        return remoteStorageManager.TaskExecutions.destroy({
                where: {
                    id: {$in: tasks.map(task => task.id)}
                }
            },
            {transaction: t}
        )
    })
}
