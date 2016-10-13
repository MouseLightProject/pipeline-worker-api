import {TaskManager, ITaskManager} from "../task-management/taskManager";

const taskManager = new TaskManager();

taskManager.connect();

export interface IGraphQLAppContext {
    taskManager: ITaskManager;
}

export class GraphQLAppContext implements IGraphQLAppContext {
    readonly taskManager: ITaskManager;

    constructor() {
        this.taskManager = taskManager;
    }
}
