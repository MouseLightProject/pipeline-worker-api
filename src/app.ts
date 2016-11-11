import * as express from "express";
import * as bodyParser from "body-parser";

const debug = require("debug")("mouselight:worker-api:server");

import serverConfiguration from "../config/server.config";
import {graphQLMiddleware, graphiQLMiddleware} from "./graphql/graphQLMiddleware";
import {SocketIoClient} from "./io/serverConnection";

const config = serverConfiguration();

const app = express();

app.use(bodyParser.urlencoded({extended: true}));

app.use(bodyParser.json());

app.use(config.graphQlEndpoint, graphQLMiddleware());

app.use(config.graphiQlEndpoint, graphiQLMiddleware(config));

SocketIoClient.use(config);

app.listen(config.port, () => debug(`API Server is now running on http://localhost:${config.port}`));
