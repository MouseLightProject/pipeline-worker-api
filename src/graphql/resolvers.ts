import {IGraphQLAppContext} from "./graphQLContext";
import {ITaskExecution, CompletionStatusCode} from "../data-model/taskExecution";
import {ITaskStatistics} from "../data-model/taskStatistics";
import {Workers, IWorker, IWorkerInput} from "../data-model/worker";
import {IPaginationConnections, ISimplePage} from "../task-management/taskManager";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";

const debug = require("debug")("mouselight:worker-api:resolvers");

interface IIdOnlyArguments {
    id: string;
}
interface ITaskIdArguments {
    taskId: string;
}

interface IRemoveCompletedArguments {
    code: CompletionStatusCode;
}

interface IRunTaskArguments {
    taskDefinitionId: string;
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
}

interface IConnectionArguments {
    first: number;
    after: string;
}

let resolvers = {
    Query: {
        taskDefinition(_, args: IIdOnlyArguments, context: IGraphQLAppContext): Promise<ITaskDefinition> {
            // debug(`get task ${args.id}`);
            return context.taskManager.getTaskDefinition(args.id);
        },
        taskDefinitions(_, __, context: IGraphQLAppContext): Promise<ITaskDefinition[]> {
            // debug("get all task definitions");
            return context.taskManager.getTaskDefinitions();
        },
        taskExecution(_, args: IIdOnlyArguments, context: IGraphQLAppContext): Promise<ITaskExecution> {
            // debug(`get task ${args.id}`);
            return context.taskManager.getTask(args.id);
        },
        taskExecutions(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            // debug("get all tasks");
            return context.taskManager.getTasks();
        },
        taskExecutionPage(_, args: IPageArguments, context: IGraphQLAppContext): Promise<ISimplePage<ITaskExecution>> {
            debug(`execution page ${args.offset} ${args.limit}`);
            return context.taskManager.getExecutionPage(args.offset, args.limit);
        },
        taskExecutionConnections(_, args: IConnectionArguments, context: IGraphQLAppContext): Promise<IPaginationConnections<ITaskExecution>> {
            return context.taskManager.getExecutionConnections(args.first, args.after);
        },
        taskStatistics(_, __, context: IGraphQLAppContext): Promise<ITaskStatistics[]> {
            // debug(`get all task statistics`);
            return context.taskManager.getStatistics();
        },
        statisticsForTask(_, args: IIdOnlyArguments, context: IGraphQLAppContext): Promise<ITaskStatistics> {
            // debug(`get task statistics for ${args.id}`);
            return context.taskManager.statisticsForTask(args.id);
        },
        runningTasks(_, __, context: IGraphQLAppContext): Promise<ITaskExecution[]> {
            // debug("get all running tasks");
            return context.taskManager.getRunningTasks();
        },
        worker(_, __, context: IGraphQLAppContext): Promise<IWorker> {
            return Workers.Instance().worker();
        },
        async workUnitCapacity(_, __, context: IGraphQLAppContext): Promise<number> {
            const worker = await Workers.Instance().worker();

            return worker.work_capacity;
        }
    },
    Mutation: {
        updateWorker(_, args: IUpdateWorkerArguments, context: IGraphQLAppContext): Promise<IWorker> {
            return context.taskManager.updateWorker(args.worker);
        },
        startTask(_, args: IRunTaskArguments, context: IGraphQLAppContext): Promise<ITaskExecution> {
            // debug(`start task with definition ${args.taskDefinitionId}`);
            return context.taskManager.startTask(args.taskDefinitionId, args.scriptArgs);
        },
        stopTask(_, args: ICancelTaskArguments, context: IGraphQLAppContext): Promise<ITaskExecution> {
            debug(`stop task ${args.taskExecutionId}`);
            return context.taskManager.stopTask(args.taskExecutionId);
        },
        removeCompletedExecutionsWithCode(_, args: IRemoveCompletedArguments, context: IGraphQLAppContext) {
            return context.taskManager.removeCompletedExecutionsWithCode(args.code);
        },
        resetStatistics(_, args: ITaskIdArguments, context: IGraphQLAppContext) {
            return context.taskManager.resetStatistics(args.taskId);
        }
    },
    TaskStatistics: {
        task(taskStatistics, _, context: IGraphQLAppContext) {
            return context.taskManager.getTaskDefinition(taskStatistics.task_id);
        }
    },
    TaskExecution: {
        task(taskExecution, _, context: IGraphQLAppContext) {
            return context.taskManager.getTaskDefinition(taskExecution.task_id);
        }
    }
};

export default resolvers;
