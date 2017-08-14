import * as Knex from "knex";

import {KnexDatabaseConfiguration} from "../options/knexOptions";

let knex = Knex(KnexDatabaseConfiguration);

export {knex};
