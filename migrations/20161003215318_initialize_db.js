exports.up = function (knex, Promise) {
    return knex.schema
        .createTable("TaskDefinition", (table) =>{
            table.uuid("id").primary().unique();
            table.string("name");
            table.string("description");
            table.string("script");
            table.string("interpreter");
            table.string("args");
            table.float("work_units");
            table.timestamp("deleted_at");
            table.timestamps();
        }).createTable("TaskExecution", (table) => {
            table.uuid("id").primary().unique();
            table.uuid("machine_id");
            table.uuid("task_id");
            table.float("work_units");
            table.string("resolved_script");
            table.string("resolved_interpreter");
            table.text("resolved_args");
            table.integer("execution_status_code"); // General status of execution
            table.integer("completion_status_code");
            table.integer("last_process_status_code"); // Last process-manager specific status observed
            table.float("max_memory");
            table.float("max_cpu");
            table.integer("exit_code");
            table.timestamp("started_at");
            table.timestamp("completed_at");
            table.timestamp("deleted_at");
            table.timestamps();
            table.foreign("task_id").references("TaskDefinition.id");
        }).createTable("TaskStatistic", (table) => {
            table.uuid("id").primary().unique();
            table.integer("num_execute");
            table.integer("num_complete");
            table.integer("num_error");
            table.integer("num_cancel");
            table.float("duration_average");
            table.float("duration_high");
            table.float("duration_low");
            table.float("cpu_average");
            table.float("cpu_high");
            table.float("cpu_low");
            table.float("memory_average");
            table.float("memory_high");
            table.float("memory_low");
            table.uuid("task_id");
            table.foreign("task_id").references("TaskDefinition.id");
            table.timestamp("deleted_at");
            table.timestamps();
        });
};

exports.down = function (knex, Promise) {
    return knex.schema
        .dropTable("TaskDefinition")
        .dropTable("TaskExecution")
        .dropTable("TaskStatistic");
};
