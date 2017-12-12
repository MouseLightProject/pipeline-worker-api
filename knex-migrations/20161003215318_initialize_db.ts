exports.up = function (knex, Promise) {
    return knex.schema
        .createTableIfNotExists("TaskExecutions", (table) => {
            table.uuid("id").primary().unique();
            table.uuid("worker_id");
            table.uuid("tile_id");
            table.uuid("task_definition_id");
            table.uuid("pipeline_stage_id");
            table.float("work_units");
            table.float("cluster_work_units");
            table.string("resolved_script");
            table.string("resolved_interpreter");
            table.text("resolved_script_args");
            table.text("resolved_cluster_args");
            table.text("resolved_log_path");
            table.integer("expected_exit_code");
            table.integer("queue_type");
            table.integer("job_id");
            table.text("job_name");
            table.integer("execution_status_code"); // General status of execution
            table.integer("completion_status_code");
            table.integer("last_process_status_code"); // Last process-manager specific status observed
            table.float("max_memory");
            table.float("max_cpu");
            table.integer("exit_code");
            table.integer("sync_status");
            table.timestamp("started_at");
            table.timestamp("completed_at");
            table.timestamp("synchronized_at"); // Task execution is fully synchronized to server
            table.timestamp("registered_at"); // Task execution has been marked complete on coordinator
            table.timestamp("deleted_at");
            table.timestamps();
        }).createTableIfNotExists("TaskStatistic", (table) => {
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
            table.uuid("task_definition_id");
            table.timestamp("deleted_at");
            table.timestamps();
        }).createTableIfNotExists("Worker", (table) => {
            table.uuid("id").primary().unique();
            table.uuid("preferred_network_interface_id");
            table.string("display_name");
            table.float("work_capacity");
            table.boolean("is_cluster_proxy");
            table.boolean("is_accepting_jobs");
            table.foreign("preferred_network_interface_id").references("NetworkInterface.id");
            table.timestamp("deleted_at");
            table.timestamps();
        }).createTableIfNotExists("NetworkInterface", (table) => {
            table.uuid("id").primary().unique();
            table.string("name");
            table.timestamp("deleted_at");
            table.timestamps();
        });
};

exports.down = function (knex, Promise) {
    return knex.schema
        .dropTable("TaskExecutions")
        .dropTable("TaskStatistic")
        .dropTable("Worker")
        .dropTable("NetworkInterface");
};
