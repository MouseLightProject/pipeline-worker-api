import {RemotePersistentStorageManager} from "../data-access/remote/databaseConnector";
import {LocalPersistentStorageManager} from "../data-access/local/databaseConnector";
import {ITaskDefinition} from "../data-model/sequelize/taskDefinition";
import {CompletionResult, ITaskExecution, ITaskExecutionAttributes} from "../data-model/sequelize/taskExecution";
import {ITaskSupervisor, QueueType, TaskSupervisor} from "../task-management/taskSupervisor";

export interface IPageInfo {
    endCursor: string,
    hasNextPage: boolean;
}

export interface IPaginationEdge<T> {
    node: T,
    cursor: string;
}

export interface IPaginationConnections<T> {
    totalCount: number;
    pageInfo: IPageInfo;
    edges: IPaginationEdge<T>[];
}

export interface ISimplePage<T> {
    offset: number;
    limit: number;
    totalCount: number;
    hasNextPage: boolean;
    items: T[]
}

export class GraphQLAppContext {
    readonly remoteStorageManager: RemotePersistentStorageManager;
    readonly localStorageManager: LocalPersistentStorageManager;
    readonly taskManager: ITaskSupervisor;

    constructor() {
        this.remoteStorageManager = RemotePersistentStorageManager.Instance();
        this.localStorageManager = LocalPersistentStorageManager.Instance();
        this.taskManager = TaskSupervisor.Instance;
    }

    public getTaskDefinition(id: string): Promise<ITaskDefinition> {
        return this.remoteStorageManager.TaskDefinitions.findById(id);
    }

    public async getTaskExecution(id: string): Promise<ITaskExecution> {
        return await this.localStorageManager.TaskExecutions.findById(id);
    }

    public async getTaskExecutions(): Promise<ITaskExecution[]> {
        return await this.localStorageManager.TaskExecutions.findAll({order: [["completed_at", "DESC"]]});
    }

    public async getTaskExecutionsPage(reqOffset: number, reqLimit: number, completionStatus: CompletionResult): Promise<ISimplePage<ITaskExecutionAttributes>> {
        let offset = 0;
        let limit = 10;

        if (reqOffset !== null && reqOffset !== undefined) {
            offset = reqOffset;
        }

        if (reqLimit !== null && reqLimit !== undefined) {
            limit = reqLimit;
        }

        const count = await this.localStorageManager.TaskExecutions.count();

        if (offset > count) {
            return {
                offset: offset,
                limit: limit,
                totalCount: count,
                hasNextPage: false,
                items: []
            };
        }

        const nodes: ITaskExecutionAttributes[] = await this.localStorageManager.TaskExecutions.getPage(offset, limit, completionStatus);

        return {
            offset: offset,
            limit: limit,
            totalCount: count,
            hasNextPage: offset + limit < count,
            items: nodes
        };
    }

    public async getTaskExecutionsConnection(first: number, after: string): Promise<IPaginationConnections<ITaskExecutionAttributes>> {
        let offset = 0;
        let limit = 10;

        if (first) {
            limit = first;
        }

        if (after) {
            offset = decodeObj64(after)["offset"] + 1;
        }

        const count = await this.localStorageManager.TaskExecutions.count();

        const nodes: ITaskExecutionAttributes[] = await this.localStorageManager.TaskExecutions.getPage(offset, limit, null);

        return {
            totalCount: count,
            pageInfo: {
                endCursor: encodeObj64({offset: offset + limit - 1}),
                hasNextPage: offset + limit < count
            },
            edges: nodes.map((node, index) => {
                return {node: node, cursor: encodeObj64({offset: offset + index})}
            })
        }
    }

    public getRunningTaskExecutions(): Promise<ITaskExecutionAttributes[]> {
        return this.localStorageManager.TaskExecutions.findRunning();
    }

    public getRunningTaskExecutionsByQueueType(queueType: QueueType): Promise<ITaskExecutionAttributes[]> {
        return this.localStorageManager.TaskExecutions.findRunningByQueueType(queueType);
    }

    public removeTaskExecutionsWithCompletionCode(code: CompletionResult): Promise<number> {
        return this.localStorageManager.TaskExecutions.removeWithCompletionCode(code);
    }
}

function encodeObj64(obj: any) {
    return encode64(JSON.stringify(obj));
}

function decodeObj64(str: string) {
    return JSON.parse(decode64(str));
}

function encode64(str: string) {
    return (new Buffer(str, "ascii")).toString("base64");
}

function decode64(str: string) {
    return (new Buffer(str, "base64")).toString("ascii");
}
