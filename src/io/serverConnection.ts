import * as socket_io from "socket.io-client";

const os = require("os");
const debug = require("debug")("mouselight:worker-api:socket.io");

import {IServerConfig, IHostInformation} from "../../config/server.config";
import {TaskExecutions} from "../data-model/taskExecution";

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

        this._hostInformation.name = os.hostname();
        this._hostInformation.osType = os.type();
        this._hostInformation.platform =  os.platform();
        this._hostInformation.arch =  os.arch();
        this._hostInformation.release =  os.release();
        this._hostInformation.cpuCount =  os.cpus().length;
        this._hostInformation.freeMemory = os.freemem();
        this._hostInformation.totalMemory = os.totalmem();
        this._hostInformation.loadAverage = os.loadavg();

        debug("interface available");

        this._socket.on("connect", () => {
            debug("connected to server");

            this._connectionStatus = ServerConnectionStatus.Connected;

            this.emitHostInformation();

            this.emitHeartBeat();

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

    private async emitHostInformation() {
        this._socket.emit("hostInformation", this._hostInformation);
    }

    private async emitHeartBeat() {

        let taskCount = -1;

        let tasks = await this._taskExecutions.getRunningTasks();

        if (tasks != null) {
            taskCount = tasks.length;
        }

        debug(`heartbeat (${taskCount} tasks)`);

        this._socket.emit("heartBeat", {
            machineId: this._hostInformation.machineId,
            runningTaskCount: taskCount
        });
    }
}
