import {GraphQLAppContext, IPaginationConnections, ISimplePage} from "./graphQLContext";
import {CompletionResult, ITaskExecutionAttributes} from "../data-model/sequelize/taskExecution";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {IWorker, IWorkerInput} from "../data-model/sequelize/worker";
import {QueueType, startTask} from "../task-management/taskSupervisor";

const debug = require("debug")("pipeline:worker-api:resolvers");

interface IIdOnlyArguments {
    id: string;
}

interface IRemoveCompletedArguments {
    code: CompletionResult;
}

interface IStartTaskArguments {
    taskInput: string;
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

export interface IStartTaskResponse {
    taskExecution: ITaskExecutionAttributes;
    localTaskLoad: number;
    clusterTaskLoad: number;
}

let resolvers = {
    Query: {
        taskExecution(_, args: IIdOnlyArguments, context: GraphQLAppContext): Promise<ITaskExecutionAttributes> {
            return context.getTaskExecution(args.id);
        },
        taskExecutions(_, __, context: GraphQLAppContext): Promise<ITaskExecutionAttributes[]> {
            return context.getTaskExecutions();
        },
        taskExecutionPage(_, args: IPageArguments, context: GraphQLAppContext): Promise<ISimplePage<ITaskExecutionAttributes>> {
            return context.getTaskExecutionsPage(args.offset, args.limit, args.status);
        },
        taskExecutionConnections(_, args: IConnectionArguments, context: GraphQLAppContext): Promise<IPaginationConnections<ITaskExecutionAttributes>> {
            return context.getTaskExecutionsConnection(args.first, args.after);
        },
        runningTasks(_, __, context: GraphQLAppContext): Promise<ITaskExecutionAttributes[]> {
            return context.getRunningTaskExecutions();
        },
        worker(_, __, context: GraphQLAppContext): IWorker {
            return LocalPersistentStorageManager.Instance().Worker;
        }
    },
    Mutation: {
        updateWorker(_, args: IUpdateWorkerArguments, context: GraphQLAppContext): Promise<IWorker> {
            return LocalPersistentStorageManager.Instance().Worker.updateFromInput(args.worker);
        },
        startTask(_, args: IStartTaskArguments, context: GraphQLAppContext): Promise<IStartTaskResponse> {
            return startTask(JSON.parse(args.taskInput));
        },
        stopTask(_, args: ICancelTaskArguments, context: GraphQLAppContext): Promise<ITaskExecutionAttributes> {
            debug(`stop task ${args.taskExecutionId}`);
            return context.taskManager.stopTask(args.taskExecutionId);
        },
        removeCompletedExecutionsWithCode(_, args: IRemoveCompletedArguments, context: GraphQLAppContext) {
            return context.removeTaskExecutionsWithCompletionCode(args.code);
        }
    },
    TaskExecution: {
        task(taskExecution, _, context: GraphQLAppContext) {
            return context.getTaskDefinition(taskExecution.task_definition_id);
        }
    },
    Worker: {
        async local_task_load(w: IWorker, _, context: GraphQLAppContext) {
            const tasks = await context.getRunningTaskExecutionsByQueueType(QueueType.Local);
            return tasks.reduce((p, t) => {
                return p + t.local_work_units;
            }, 0);
        },
        async cluster_task_load(w: IWorker, _, context: GraphQLAppContext) {
            const tasks = await context.getRunningTaskExecutionsByQueueType(QueueType.Cluster);
            return tasks.reduce((p, t) => {
                return p + t.cluster_work_units;
            }, 0);
        }
    }
};

export default resolvers;
