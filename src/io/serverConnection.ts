import * as socket_io from "socket.io-client";

const os = require("os");
const debug = require("debug")("mouselight:worker-api:socket.io");

import {IServerConfig, IHostInformation} from "../../config/server.config";
import {TaskExecutions, ITaskExecution} from "../data-model/taskExecution";

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

    public static get status(): ServerConnectionStatus {
        if (this._ioClient) {
            return this._ioClient.connectionStatus;
        } else {
            return ServerConnectionStatus.Uninitialized;
        }
    }

    public static use(config: IServerConfig) {
        this._ioClient = new SocketIoClient(config);
    }

    private _socket;

    private _hostInformation: IHostInformation = null;

    private _heartBeatInterval = null;

    private _connectionStatus = ServerConnectionStatus.Creating;

    private _taskExecutions = new TaskExecutions();

    public get connectionStatus(): ServerConnectionStatus {
        return this._connectionStatus;
    }

    private constructor(config: IServerConfig) {
        this._socket = socket_io(`http://${config.managementService.host}:${config.managementService.port}`);

        this._hostInformation = config.hostInformation;

        debug("interface available");

        this._socket.on("connect", async () => {
            debug("connected to server");

            this._connectionStatus = ServerConnectionStatus.Connected;

            this.emitHostInformation();

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
            debug(`reconnect attempt ${count}`);

            this._connectionStatus = ServerConnectionStatus.Reconnecting;
        });

        this._socket.on("reconnect_error", reason => {
            debug("reconnection error");

            this._connectionStatus = ServerConnectionStatus.ReconnectionError;
        });

        this._socket.on("disconnect", () => {
            debug("disconnected");

            this._connectionStatus = ServerConnectionStatus.Disconnected;
        });
    }

    private emitHostInformation() {
        this._socket.emit("hostInformation", this._hostInformation);
    }

    private async emitHeartBeat() {

        let taskLoad = -1;

        let tasks: ITaskExecution[] = await this._taskExecutions.getRunningTasks();

        if (tasks != null) {
            taskLoad = tasks.reduce((total: number, task) => {
                return task.work_units + total;
            }, 0);
        }

        debug(`heartbeat (${taskLoad} task load)`);

        this._socket.emit("heartBeat", {
            machineId: this._hostInformation.machineId,
            taskLoad: taskLoad
        });
    }
}
