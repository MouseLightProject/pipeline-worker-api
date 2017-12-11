import {GraphQLAppContext, IPaginationConnections, ISimplePage} from "./graphQLContext";
import {ITaskStatistics, taskStatisticsInstance} from "../data-model/taskStatistics";
import {Workers, IWorker, IWorkerInput} from "../data-model/worker";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionResult, ITaskExecution} from "../data-model/sequelize/taskExecution";

const debug = require("debug")("pipeline:worker-api:resolvers");

interface IIdOnlyArguments {
    id: string;
}
interface ITaskIdArguments {
    taskId: string;
}

interface IRemoveCompletedArguments {
    code: CompletionResult;
}

interface IRunTaskArguments {
    taskDefinitionId: string;
    pipelineStageId: string;
    tileId: string;
    scriptArgs: Array<string>;
}

interface ICancelTaskArguments {
    taskExecutionId: string;
    forceIfNeeded: boolean;
}

interface IUpdateWorkerArguments {
    worker: IWorkerInput;
}

interface IPageArguments {
    offset: number;
    limit: number;
    status: CompletionResult;
}

interface IConnectionArguments {
    first: number;
    after: string;
}

let resolvers = {
    Query: {
        taskDefinition(_, args: IIdOnlyArguments, context: GraphQLAppContext): Promise<ITaskDefinition> {
            return context.getTaskDefinition(args.id);
        },
        taskDefinitions(_, __, context: GraphQLAppContext): Promise<ITaskDefinition[]> {
            return context.getTaskDefinitions();
        },
        taskExecution(_, args: IIdOnlyArguments, context: GraphQLAppContext): Promise<ITaskExecution> {
            return context.getTaskExecution(args.id);
        },
        taskExecutions(_, __, context: GraphQLAppContext): Promise<ITaskExecution[]> {
             return context.getTaskExecutions();
        },
        taskExecutionPage(_, args: IPageArguments, context: GraphQLAppContext): Promise<ISimplePage<ITaskExecution>> {
            return context.getTaskExecutionsPage(args.offset, args.limit, args.status);
        },
        taskExecutionConnections(_, args: IConnectionArguments, context: GraphQLAppContext): Promise<IPaginationConnections<ITaskExecution>> {
            return context.getTaskExecutionsConnection(args.first, args.after);
        },
        taskStatistics(_, __, context: GraphQLAppContext): Promise<ITaskStatistics[]> {
            return taskStatisticsInstance.getAll();
        },
        statisticsForTask(_, args: IIdOnlyArguments, context: GraphQLAppContext): Promise<ITaskStatistics> {
            return taskStatisticsInstance.getForTaskId(args.id);
        },
        runningTasks(_, __, context: GraphQLAppContext): Promise<ITaskExecution[]> {
            return context.getRunningTaskExecutions();
        },
        worker(_, __, context: GraphQLAppContext): Promise<IWorker> {
            return Workers.Instance().worker();
        }
    },
    Mutation: {
        updateWorker(_, args: IUpdateWorkerArguments, context: GraphQLAppContext): Promise<IWorker> {
            return  Workers.Instance().updateFromInput(args.worker);
        },
        startTask(_, args: IRunTaskArguments, context: GraphQLAppContext): Promise<ITaskExecution> {
            return context.taskManager.startTask(args.taskDefinitionId, args.pipelineStageId, args.tileId, args.scriptArgs);
        },
        stopTask(_, args: ICancelTaskArguments, context: GraphQLAppContext): Promise<ITaskExecution> {
            debug(`stop task ${args.taskExecutionId}`);
            return context.taskManager.stopTask(args.taskExecutionId);
        },
        removeCompletedExecutionsWithCode(_, args: IRemoveCompletedArguments, context: GraphQLAppContext) {
            return context.removeTaskExecutionsWithCompletionCode(args.code);
        },
        resetStatistics(_, args: ITaskIdArguments, context: GraphQLAppContext) {
            return taskStatisticsInstance.reset(args.taskId);
        }
    },
    TaskStatistics: {
        task(taskStatistics, _, context: GraphQLAppContext) {
            return context.getTaskDefinition(taskStatistics.task_definition_id);
        }
    },
    TaskExecution: {
        task(taskExecution, _, context: GraphQLAppContext) {
            return context.getTaskDefinition(taskExecution.task_definition_id);
        }
    }
};

export default resolvers;