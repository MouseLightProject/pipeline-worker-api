import * as express from "express";
import * as bodyParser from "body-parser";

const debug = require("debug")("pipeline:worker-api:server");

import {graphQLMiddleware, graphiQLMiddleware} from "./graphql/graphQLMiddleware";
import {SocketIoClient} from "./io/serverConnection";
import {MainQueue} from "./message-queue/mainQueue";
import {LocalPersistentStorageManager} from "./data-access/local/databaseConnector";
import {ServiceConfiguration} from "./options/serviceConfig";
import {CoordinatorService} from "./options/coreServicesOptions";

start().then().catch((err) => debug(err));

async function start() {
    const worker = await LocalPersistentStorageManager.Instance().initialize();

    await MainQueue.Instance.connect();

    const PORT = ServiceConfiguration.networkPort;

    const app = express();

    app.use(bodyParser.urlencoded({extended: true}));

    app.use(bodyParser.json());

    app.use(ServiceConfiguration.graphQlEndpoint, graphQLMiddleware());

    app.use(["/", ServiceConfiguration.graphiQlEndpoint], graphiQLMiddleware(ServiceConfiguration));

    SocketIoClient.use(worker, CoordinatorService);

    app.listen(PORT, () => debug(`API Server is now running on http://localhost:${PORT}`));
}
