import * as Knex from "knex";

import databaseConfiguration from "../../config/database.config";

let knex = Knex(databaseConfiguration());

export {knex};
