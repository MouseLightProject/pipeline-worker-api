import * as amqp from "amqplib";
import {Connection, Channel} from "amqplib";
import {ITaskExecutionAttributes} from "../data-model/sequelize/taskExecution";
import {MessageQueueService} from "../options/coreServicesOptions";

const debug = require("debug")("pipeline:main-queue");

const TaskExecutionUpdateQueue = "TaskExecutionUpdateQueue";

export class MainQueue {
    private static instance: MainQueue = new MainQueue();

    private connection: Connection = null;
    private channel: Channel = null;

    public static get Instance() {
        return this.instance;
    }

    public async Connect(): Promise<void> {
        const url = `amqp://${MessageQueueService.host}:${MessageQueueService.port}`;

        debug(`main queue url: ${url}`);

        try {
            this.connection = await amqp.connect(url);

            this.channel = await this.connection.createChannel();

            await this.channel.assertQueue(TaskExecutionUpdateQueue, {durable: true});
        } catch (err) {
            debug("failed to connect");
            debug(err);
        }

        debug(`main queue ready`);
    }

    public SendTaskExecutionUpdate(taskExecution: ITaskExecutionAttributes) {
        if (this.channel) {
            this.channel.sendToQueue(TaskExecutionUpdateQueue, new Buffer(JSON.stringify(taskExecution)), {persistent: true});
        }
    }
}
