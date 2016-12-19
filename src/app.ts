import * as express from "express";
import * as bodyParser from "body-parser";

const debug = require("debug")("mouselight:worker-api:server");

import readServerConfiguration from "../config/server.config";
import {graphQLMiddleware, graphiQLMiddleware} from "./graphql/graphQLMiddleware";
import {SocketIoClient} from "./io/serverConnection";

const serverConfiguration = readServerConfiguration();

const app = express();

app.use(bodyParser.urlencoded({extended: true}));

app.use(bodyParser.json());

app.use(serverConfiguration.graphQlEndpoint, graphQLMiddleware());

app.use(serverConfiguration.graphiQlEndpoint, graphiQLMiddleware(serverConfiguration));

SocketIoClient.use(serverConfiguration);

app.listen(serverConfiguration.port, () => debug(`API Server is now running on http://localhost:${serverConfiguration.port}`));
