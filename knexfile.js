/*
 * Called from the knex command line - es5 only.
 */
require('babel-register');

const databaseConfiguration = require("./config/database.config.js").default();

module.exports = databaseConfiguration;