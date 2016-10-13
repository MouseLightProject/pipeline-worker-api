exports.up = function (knex, Promise) {
    return knex.schema
        .createTable('TaskDefinitions', (table) =>{
            table.uuid('id').primary().unique();
            table.string('name');
            table.string('description');
            table.string('script');
            table.string('interpreter');
            table.timestamp('deleted_at');
            table.timestamps();
        }).createTable('TaskExecutions', (table) => {
            table.uuid('id').primary().unique();
            table.string('resolved_script');
            table.string('resolved_interpreter');
            table.integer('execution_status_code'); // General status of execution
            table.integer('completion_status_code');
            table.uuid('machine_id');
            table.timestamp('started_at');
            table.timestamp('completed_at');
            table.text('script_args');
            table.integer('last_process_status_code'); // Last process-manager specific status observed
            table.float('max_memory');
            table.float('max_cpu');
            table.integer('exit_code');
            table.uuid('task_id');
            table.foreign('task_id').references('TaskDefinitions.id');
            table.timestamp('deleted_at');
            table.timestamps();
        }).createTable('TaskStatistics', (table) => {
            table.uuid('id').primary().unique();
            table.integer('num_execute');
            table.integer('num_complete');
            table.integer('num_error');
            table.integer('num_cancelled');
            table.float('duration_avg');
            table.float('duration_long');
            table.uuid('task_id');
            table.foreign('task_id').references('TaskDefinitions.id');
            table.timestamp('deleted_at');
            table.timestamps();
        });
};

exports.down = function (knex, Promise) {
    return knex.schema
        .dropTable('TaskDefinitions')
        .dropTable('TaskExecutions')
        .dropTable('TaskStatistics');
};
