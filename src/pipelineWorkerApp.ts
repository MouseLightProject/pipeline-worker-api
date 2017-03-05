import * as express from "express";
import * as bodyParser from "body-parser";

const debug = require("debug")("mouselight:worker-api:server");

import readServerConfiguration from "../config/server.config";
import {graphQLMiddleware, graphiQLMiddleware} from "./graphql/graphQLMiddleware";
import {SocketIoClient} from "./io/serverConnection";
import {Workers} from "./data-model/worker";

start().then(() => {
});

async function start() {
    const worker = await Workers.Instance().worker();

    const serverConfiguration = readServerConfiguration();

    const PORT = serverConfiguration.apiService.networkPort;

    const app = express();

    app.use(bodyParser.urlencoded({extended: true}));

    app.use(bodyParser.json());

    app.use(serverConfiguration.apiService.graphQlEndpoint, graphQLMiddleware());

    app.use(serverConfiguration.apiService.graphiQlEndpoint, graphiQLMiddleware(serverConfiguration.apiService));

    SocketIoClient.use(worker, serverConfiguration);

    app.listen(PORT, () => debug(`API Server is now running on http://localhost:${PORT}`));
}
