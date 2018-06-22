import * as socket_io from "socket.io-client";

const debug = require("debug")("pipeline:worker-api:socket.io");

import {ITaskExecutionAttributes} from "../data-model/sequelize/taskExecution";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {MachineProperties} from "../system/systemProperties";
import {IWorker} from "../data-model/sequelize/worker";
import {ICoordinatorService} from "../options/coreServicesOptions";
import {ServiceConfiguration} from "../options/serviceConfig";
import {QueueType} from "../task-management/taskSupervisor";

export enum ServerConnectionStatus {
    Uninitialized,
    Creating,
    Connected,
    Reconnecting,
    Disconnected,
    ConnectionError,
    ReconnectionError
}

export class SocketIoClient {
    private static _HEARTBEAT_INTERVAL_SECONDS = 10;

    private static _ioClient: SocketIoClient = null;

    public static use(worker: IWorker, coordinatorService: ICoordinatorService) {
        this._ioClient = new SocketIoClient(worker, coordinatorService);
    }

    private _socket;

    private _worker: IWorker;

    private _heartBeatInterval = null;

    private _connectionStatus = ServerConnectionStatus.Creating;

    private _localStorageManager = LocalPersistentStorageManager.Instance();

    private constructor(worker: IWorker, coordinatorService: ICoordinatorService) {
        this._worker = worker;

        this._socket = socket_io(`http://${coordinatorService.host}:${coordinatorService.port}`);

        debug("interface available");

        this._socket.on("connect", async () => {
            debug("connected to server");

            this._connectionStatus = ServerConnectionStatus.Connected;

            this.emitHostInformation(worker);

            await this.emitHeartBeat();

            if (!this._heartBeatInterval) {
                this._heartBeatInterval = setInterval(() => this.emitHeartBeat(), SocketIoClient._HEARTBEAT_INTERVAL_SECONDS * 1000);
            }
        });

        this._socket.on("error", reason => {
            debug("connection error");
            this._connectionStatus = ServerConnectionStatus.ConnectionError;
        });

        this._socket.on("reconnect", count => {
            debug(`reconnected after ${count} attempts`);
            this._connectionStatus = ServerConnectionStatus.Connected;
        });

        this._socket.on("reconnecting", count => {
            if (count % 10 === 0) {
                debug(`reconnect attempt ${count}`);
            }
            this._connectionStatus = ServerConnectionStatus.Reconnecting;
        });

        this._socket.on("reconnect_error", reason => {
            // debug("reconnection error");
            this._connectionStatus = ServerConnectionStatus.ReconnectionError;
        });

        this._socket.on("disconnect", () => {
            debug("disconnected");
            this._connectionStatus = ServerConnectionStatus.Disconnected;
        });
    }

    private emitHostInformation(worker: IWorker) {
        this._socket.emit("workerApiService", {
            worker: worker,
            service: ServiceConfiguration,
            machine: MachineProperties
        });
    }

    private async emitHeartBeat() {
        try {
            let localTaskLoad = 0;
            let clusterTaskLoad = 0;

            const tasks: ITaskExecutionAttributes[] = await this._localStorageManager.TaskExecutions.findRunning();

            tasks.map((t) => {
                if (t.queue_type === QueueType.Local) {
                    localTaskLoad += t.local_work_units;
                } else {
                    clusterTaskLoad += t.cluster_work_units;
                }
            });

            this._socket.emit("heartBeat", {
                worker: this._worker.toJSON(),
                localTaskLoad,
                clusterTaskLoad
            });

        } catch (err) {
            debug("failed to emit heartbeat");
            debug(err);
        }
    }
}
