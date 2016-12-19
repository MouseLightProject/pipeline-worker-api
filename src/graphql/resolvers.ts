import {IGraphQLAppContext} from "./graphQLContext";
import {ITaskExecution} from "../data-model/taskExecution";
import {ITaskDefinition} from "../data-model/taskDefinition";
import {ITaskStatistics} from "../data-model/taskStatistics";

const debug = require("debug")("mouselight:worker-api:resolvers");

interface IIdOnlyArguments {
    id: string;
}

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
        taskExecution(_, args: IIdOnlyArguments, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug(`get task ${args.id}`);
            return context.taskManager.getTask(args.id);
        },
        taskExecutions(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug("get all tasks");
            return context.taskManager.getTasks();
        },
        taskStatistics(_, __, context: IGraphQLAppContext): Promise<ITaskStatistics[]> {
            debug(`get all task statistics`);
            return context.taskManager.getStatistics();
        },
        statisticsForTask(_, args: IIdOnlyArguments, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug(`get task statistics for ${args.id}`);
            return context.taskManager.statisticsForTask(args.id);
        },
        runningTasks(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            debug("get all running tasks");
            return context.taskManager.getRunningTasks();
        },
        workUnitCapacity(_, __, context: IGraphQLAppContext): number {
            return context.serverConfiguration.hostInformation.workUnitCapacity;
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
        stopTask(_, args: ICancelTaskArguments, context: IGraphQLAppContext): Promise<ITaskExecution> {
            debug(`stop task ${args.taskExecutionId}`);
            return context.taskManager.stopTask(args.taskExecutionId);
        },
        refreshTasksFromProcessManager(_, __, context: IGraphQLAppContext) {
            debug("refresh tasks");
            return context.taskManager.refreshTasksFromProcessManager();
        },
        refreshTaskFromProcessManager(_, {taskExecutionId}, context: IGraphQLAppContext) {
            debug(`refresh task ${taskExecutionId}`);
            return context.taskManager.refreshTaskFromProcessManager(taskExecutionId);
        },
        clearAllCompleteExecutions(_, __, context: IGraphQLAppContext) {
            return context.taskManager.clearAllCompleteExecutions();
        },
        resetStatistics(_, __, context: IGraphQLAppContext) {
            return context.taskManager.resetStatistics();
        }
    }
};

export default resolvers;
