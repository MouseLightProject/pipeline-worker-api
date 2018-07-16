export = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable(
            "TaskExecutions",
            {
                id: {
                    primaryKey: true,
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4
                },
                remote_task_execution_id: Sequelize.UUID,
                worker_id: Sequelize.UUID,
                task_definition_id: Sequelize.UUID,
                pipeline_stage_id: Sequelize.UUID,
                tile_id: Sequelize.TEXT,
                local_work_units: Sequelize.DOUBLE,
                cluster_work_units: Sequelize.DOUBLE,
                resolved_output_path: Sequelize.TEXT,
                resolved_script: Sequelize.TEXT,
                resolved_interpreter: Sequelize.TEXT,
                resolved_script_args: Sequelize.TEXT,
                resolved_cluster_args: Sequelize.TEXT,
                resolved_log_path: Sequelize.TEXT,
                expected_exit_code: Sequelize.INTEGER,
                queue_type: Sequelize.INTEGER,
                job_id: Sequelize.INTEGER,
                job_name: Sequelize.TEXT,
                execution_status_code: Sequelize.INTEGER,
                completion_status_code: Sequelize.INTEGER,
                last_process_status_code: Sequelize.INTEGER,
                exit_code: Sequelize.INTEGER,
                cpu_time_seconds: Sequelize.DOUBLE,
                max_cpu_percent: Sequelize.DOUBLE,
                max_memory_mb: Sequelize.DOUBLE,
                sync_status: Sequelize.INTEGER,
                started_at: Sequelize.DATE,
                submitted_at: Sequelize.DATE,
                completed_at: Sequelize.DATE,
                synchronized_at: Sequelize.DATE,
                registered_at: Sequelize.DATE,
                created_at: Sequelize.DATE,
                updated_at: Sequelize.DATE,
                deleted_at: Sequelize.DATE
            });

        await queryInterface.createTable(
            "Workers",
            {
                id: {
                    primaryKey: true,
                    type: Sequelize.UUID,
                    defaultValue: Sequelize.UUIDV4
                },
                display_name: Sequelize.TEXT,
                local_work_capacity: Sequelize.FLOAT,
                cluster_work_capacity: Sequelize.FLOAT,
                is_accepting_jobs: Sequelize.BOOLEAN,
                created_at: Sequelize.DATE,
                updated_at: Sequelize.DATE,
                deleted_at: Sequelize.DATE
            });
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.dropTable("Workers");
        await queryInterface.dropTable("TaskExecutions");
    }
};
