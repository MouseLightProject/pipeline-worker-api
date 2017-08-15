import {taskManager, ITaskManager} from "../task-management/taskManager";
import readServerConfiguration from "../options/serviceConfig";
import {IServerConfig} from "../options/serviceConfig";

const debug = require("debug")("pipeline:worker-api:graphql-context");

const serverConfiguration = readServerConfiguration();

export interface IGraphQLAppContext {
    taskManager: ITaskManager;
    serverConfiguration: IServerConfig;
}

export class GraphQLAppContext implements IGraphQLAppContext {
    readonly taskManager: ITaskManager;
    readonly serverConfiguration: IServerConfig;

    constructor() {
        this.taskManager = taskManager;
        this.serverConfiguration = serverConfiguration;
    }
}
