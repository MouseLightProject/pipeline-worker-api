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

    // TODO This should be handled with the sync status in the database, not by storing in memory and hoping the
    // connection comes back before the process stops.
    private missingChannelBuffer: ITaskExecutionAttributes[] = [];

    public static get Instance() {
        return this.instance;
    }

    public async connect(): Promise<void> {
        const url = `amqp://${MessageQueueService.host}:${MessageQueueService.port}`;

        debug(`main queue url: ${url}`);

        try {
            this.connection = await amqp.connect(url);

            this.connection.on("error", (err) => {
                this.channel = null;
                debug("connection error - reconnect in 5 seconds");
                debug(err);
                setInterval(() => this.connect(), 5000);
            });

            this.channel = await this.connection.createChannel();

            await this.channel.assertQueue(TaskExecutionUpdateQueue, {durable: true});

            this.sendBuffer();
        } catch (err) {
            debug("failed to connect");
            debug(err);
        }

        debug(`main queue ready`);
    }

    public sendTaskExecutionUpdate(taskExecution: ITaskExecutionAttributes) {
        try {
            if (this.channel) {
                this.channel.sendToQueue(TaskExecutionUpdateQueue, new Buffer(JSON.stringify(taskExecution)), {persistent: true});
            } else {
                this.missingChannelBuffer.push(taskExecution);
            }
        }
        catch (err) {
            debug(err);
            this.missingChannelBuffer.push(taskExecution);
        }
    }

    private sendBuffer() {
        if (this.missingChannelBuffer.length > 0) {
            this.sendTaskExecutionUpdate(this.missingChannelBuffer.shift());
            setTimeout(() => this.sendBuffer(), 250);
        }
    }
}
