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

if (workerId && completionCode) {
    synchronizeTaskExecutions(workerId, parseInt(completionCode)).then((result) => {
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

const remoteStorageManager = RemotePersistentStorageManager.Instance();
const localStorageManager = LocalPersistentStorageManager.Instance();

export async function watchdogInProgressSync(workerId: string) {
    const tenMinutesAgo = new Date();

    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const suspects = await localStorageManager.TaskExecutions.findAll({
        where: {
            sync_status: SyncStatus.InProgress,
            sync_completed_at: {$lt: tenMinutesAgo}
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

        // The array of all local failed, canceled, etc tasks.
        const local = await localStorageManager.TaskExecutions.findAll({
            where: {
                execution_status_code: ExecutionStatusCode.Completed,
                completion_status_code: completionCode,
                $or: [{sync_status: SyncStatus.Never}, {sync_status: SyncStatus.Expired}]
            }
        });

        // Find any in that batch that may have been sync'd in some other status.
        const remote = await remoteStorageManager.TaskExecutions.findAll({
            where: {
                id: {$in: local.map(t => t.id)}
            }
        });

        const inserting = _.differenceBy<ITaskExecution>(local, remote, "id");

        await setSyncStatus(inserting, SyncStatus.InProgress);

        await insertRemote(inserting);

        await setSyncStatus(inserting, SyncStatus.Complete);

        const updating = _.intersectionBy(local, remote, "id");

        await setSyncStatus(updating, SyncStatus.InProgress);

        await updateRemote(updating);

        await setSyncStatus(updating, SyncStatus.Complete);
    }
    catch (err) {
        debug(err);
    }
}

async function setSyncStatus(tasks: ITaskExecution[], syncStatus: SyncStatus) {
    await localStorageManager.Connection.transaction(t => {
        return Promise.all(tasks.map(task => {
            task.sync_status = syncStatus;

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

            obj.sync_status = SyncStatus.Never;
            obj.synchronized_at = null;

            const remote = await remoteStorageManager.TaskExecutions.findById(obj.id);

            remote.update(obj);
        }))
    });
}