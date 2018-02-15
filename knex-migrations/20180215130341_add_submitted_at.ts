exports.up = function (knex, Promise) {
    return knex.schema.table("TaskExecutions", table => {
        table.timestamp("submitted_at");
    });
};

exports.down = function (knex, Promise) {
    return null;
};
