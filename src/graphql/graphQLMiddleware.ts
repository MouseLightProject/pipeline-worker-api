import * as apolloServer  from "apollo-server";

import {schema} from "./schema";
import {GraphQLAppContext} from "./graphQLContext";

export function graphQLMiddleware() {
    return apolloServer.apolloExpress(graphqlRequestHandler);
}

export function graphiQLMiddleware(configuration) {
    return apolloServer.graphiqlExpress({endpointURL: configuration.graphQlEndpoint});
}

function graphqlRequestHandler(req) {
    // Get the query, the same way express-graphql does it.
    // https://github.com/graphql/express-graphql/blob/3fa6e68582d6d933d37fa9e841da5d2aa39261cd/src/index.js#L257
    const query = req.query.query || req.body.query;

    if (query && query.length > 3000) {
        // None of our app's queries are this long.  Probably indicates someone trying to send an overly expensive query.
        throw new Error("Query too large.");
    }

    // Although most (all?) of the current context is global, Apollo recommends creating a per request context. Within
    // the GraphQLAppContext constructor we may choose to simply return the same contents so long as there is no need
    // for per-request context, but maintain the recommended pattern at this level.
    let appContext = new GraphQLAppContext();

    return {
        schema: schema,
        context: appContext,
        rootValue: {}
    };
}
