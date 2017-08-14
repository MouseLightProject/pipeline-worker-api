import * as Knex from "knex";

import databaseConfiguration from "../options/knexOptions";

let knex = Knex(databaseConfiguration());

export {knex};
