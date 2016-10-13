'use strict';

exports.seed = (knex, Promise) => {
    // Deletes ALL existing entries
    let promise1 = knex('TaskDefinitions').del()
        .then(() => {
            return Promise.all([
                // Inserts seed entries
                knex('TaskDefinitions').insert({
                    id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3',
                    name: 'Python Sample Task',
                    description: 'Simple python script to test worker execution',
                    script: 'test/pytest.py',
                    interpreter: 'python',
                    created_at: createDate(3, 0)
                }),
                knex('TaskDefinitions').insert({
                    id: '04B8313E-0E96-4194-9C06-22771ACD3986',
                    name: 'General Command Sample Task',
                    description: 'Simple command to test worker execution',
                    script: 'test/echo.sh',
                    interpreter: 'none',
                    created_at: createDate(2, 0),
                    updated_at: createDate(1, 3.5)
                }),
                knex('TaskDefinitions').insert({
                    id: '17610E93-5F57-43A1-8281-73E75CA47E56',
                    name: 'MATLAB Sample Task',
                    description: 'Simple MATLAB executable to test worker execution',
                    script: 'mltest',
                    interpreter: 'none',
                    created_at: createDate(1, 0)
                }),
                knex('TaskDefinitions').insert({
                    id: '0318DE38-9515-4042-BDF1-7FEF2147EBC7',
                    name: 'Sample Deleted Task',
                    description: 'Simple python script to test worker execution',
                    script: 'test/pytest.py',
                    interpreter: 'python',
                    created_at: createDate(3, 0)
                }),
            ]);
        });

    let promise2 = knex('TaskExecutions').del()
        .then(() => {
            return Promise.all([
                // Inserts seed entries
                knex('TaskExecutions').insert({
                    id: '5177AA78-B29A-4C5E-80F2-593309086B47',
                    resolved_script: "/usr/local/scripts/test/pytest.py",
                    resolved_interpreter: "python",
                    execution_status_code: 4,
                    completion_status_code: 2,
                    machine_id: '1BCC812D-97CE-4B14-AD48-5C3C9B9B416E',
                    started_at: createDate(4, 3.5),
                    completed_at: createDate(4, 2.5),
                    script_args: "",
                    last_process_status_code: 5,
                    max_cpu: 55.25,
                    max_memory: 46521685,
                    exit_code: 0,
                    task_id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3',
                    created_at: createDate(4, 4),
                    updated_at: createDate(4, 0)
                }),
                knex('TaskExecutions').insert({
                    id: 'F7D6A5D7-57A4-4286-97F2-C24E08CFE50B',
                    resolved_script: "/usr/local/scripts/test/pytest.py",
                    resolved_interpreter: "python",
                    execution_status_code: 3,
                    completion_status_code: 4,
                    machine_id: '1BCC812D-97CE-4B14-AD48-5C3C9B9B416E',
                    started_at: createDate(3, 2.5),
                    completed_at: createDate(3, 1.5),
                    script_args: "",
                    last_process_status_code: 5,
                    max_cpu: 15.25,
                    max_memory: 203521685,
                    exit_code: 3,
                    task_id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3',
                    created_at: createDate(3, 3),
                    updated_at: createDate(3, 0)
                }),
                knex('TaskExecutions').insert({
                    id: 'F59B2A7F-5517-429D-B4A7-2EF8ABA7C0F4',
                    resolved_script: "/usr/local/scripts/test/echo.sh",
                    resolved_interpreter: "none",
                    execution_status_code: 4,
                    completion_status_code: 2,
                    machine_id: '1BCC812D-97CE-4B14-AD48-5C3C9B9B416E',
                    started_at: createDate(2, 1.5),
                    completed_at: createDate(2, 0.5),
                    script_args: "Hello World",
                    last_process_status_code: 5,
                    max_cpu: 32.8,
                    max_memory: 6521685,
                    exit_code: 0,
                    task_id: '04B8313E-0E96-4194-9C06-22771ACD3986',
                    created_at: createDate(2, 2),
                    updated_at: createDate(2, 0)
                })
            ])
                ;
        });

    return Promise.all([promise1, promise2]);
};

function createDate(daysBefore, hoursBefore) {
    var date = new Date();

    date.setDate(date.getDate() - daysBefore);

    date.setHours(date.getHours() - hoursBefore);

    return date;
}
