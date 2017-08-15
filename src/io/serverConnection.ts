import * as socket_io from "socket.io-client";

const debug = require("debug")("pipeline:worker-api:socket.io");

import {IServerConfig, IApiServiceConfiguration} from "../options/serviceConfig";
import {TaskExecutions, ITaskExecution} from "../data-model/taskExecution";
import {IWorker, Workers} from "../data-model/worker";

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

    public static use(worker: IWorker, config: IServerConfig) {
        this._ioClient = new SocketIoClient(worker, config);
    }

    private _socket;

    private _apiService: IApiServiceConfiguration = null;

    private _heartBeatInterval = null;

    private _connectionStatus = ServerConnectionStatus.Creating;

    private _taskExecutions = new TaskExecutions();

    private constructor(worker: IWorker, config: IServerConfig) {
        this._socket = socket_io(`http://${config.managementService.host}:${config.managementService.port}`);

        this._apiService = config.apiService;

        debug("interface available");

        this._socket.on("connect", async() => {
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
        this._socket.emit("workerApiService", {worker: worker, service: this._apiService});
    }

    private async emitHeartBeat() {

        let taskLoad = -1;

        let tasks: ITaskExecution[] = await this._taskExecutions.getRunningTasks();

        if (tasks != null) {
            taskLoad = tasks.reduce((total: number, task) => {
                return task.work_units + total;
            }, 0);
        }

        const worker = await Workers.Instance().worker();

        this._socket.emit("heartBeat", {
            worker: worker,
            taskLoad: taskLoad
        });
    }
}
