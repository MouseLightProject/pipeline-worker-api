exports.up = function (knex, Promise) {
    return knex.schema
        .createTable("Worker", (table) => {
            table.uuid("id").primary().unique();
            table.uuid("preferred_network_interface_id");
            table.string("display_name");
            table.float("work_capacity");
            table.boolean("is_cluster_proxy");
            table.boolean("is_accepting_jobs");
            table.foreign("preferred_network_interface_id").references("NetworkInterface.id");
            table.timestamp("deleted_at");
            table.timestamps();
        }).createTable("NetworkInterface", (table) => {
            table.uuid("id").primary().unique();
            table.string("name");
            table.timestamp("deleted_at");
            table.timestamps();
        });
};

exports.down = function (knex, Promise) {
    return knex.schema
        .dropTable("Worker")
        .dropTable("NetworkInterface");
};
