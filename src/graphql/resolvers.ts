import {IGraphQLAppContext} from "./graphQLContext";
import {ITaskExecution} from "../data-model/taskExecution";
import {ITaskDefinition} from "../data-model/taskDefinition";

const debug = require("debug")("mouselight:worker-api:resolvers");

interface IDebugMessageArguments {
    msg: string;
}

interface IRunTaskArguments {
    taskDefinitionId: string;
    scriptArgs: Array<string>;
}

interface ICancelTaskArguments {
    taskExecutionId: string;
    forceIfNeeded: boolean;
}

let resolvers = {
    Query: {
        taskDefinitions(_, __, context: IGraphQLAppContext): Promise<ITaskDefinition[]> {
            debug("get all task definitions");
            return context.taskManager.getTaskDefinitions();
        },
        taskExecutions(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug("get all tasks");
            return context.taskManager.getTasks();
        },
        runningTasks(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug("get all running tasks");
            return context.taskManager.getRunningTasks();
        }
    },
    Mutation: {
        debugMessage(_, args: IDebugMessageArguments): string {
            debug(`debug message: ${args.msg}`);
            return "OK";
        },
        startTask(_, args: IRunTaskArguments, context: IGraphQLAppContext): Promise<ITaskExecution> {
            debug(`start task with definition ${args.taskDefinitionId}`);
            return context.taskManager.startTask(args.taskDefinitionId, args.scriptArgs);
        },
        stopTask(_, args: ICancelTaskArguments, context: IGraphQLAppContext): void {
            debug(`stop task ${args.taskExecutionId}`);
            console.log(`Cancel task ${args.taskExecutionId} (force - ${args.forceIfNeeded}) - not implemented.`);
        },
        refreshTasksFromProcessManager(_, __, context: IGraphQLAppContext) {
            debug("refresh tasks");
            return context.taskManager.refreshTasksFromProcessManager();
        },
        refreshTaskFromProcessManager(_, {taskExecutionId}, context: IGraphQLAppContext) {
            debug(`refresh task ${taskExecutionId}`);
            return context.taskManager.refreshTaskFromProcessManager(taskExecutionId);
        }/*,
        deleteTask(_, {taskExecutionId}, context: IGraphQLAppContext) {
            debug(`delete task ${taskExecutionId}`);
            return context.taskManager.deleteTask(taskExecutionId);
        }*/
    }
};

export default resolvers;
