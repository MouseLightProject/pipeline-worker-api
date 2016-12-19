'use strict';

exports.seed = (knex, Promise) => {
    // Deletes ALL existing entries
    let promise1 = knex('TaskDefinition').del()
        .then(() => {
            return Promise.all([
                // Inserts seed entries
                knex('TaskDefinition').insert({
                    id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3'.toLocaleLowerCase(),
                    name: 'ilastik Pixel Classifier Test',
                    description: 'Calls ilastik with test project.',
                    script: 'test/pixel_classifier_test/pixel_shell.sh',
                    interpreter: 'none',
                    args: '/Users/pedson/Developer/Leap/Janelia/acq-dashboard-worker-api/test/pixel_classifier_test',
                    work_units: 1,
                    created_at: createDate(3, 0)
                }),
                knex('TaskDefinition').insert({
                    id: '04B8313E-0E96-4194-9C06-22771ACD3986'.toLocaleLowerCase(),
                    name: 'Echo',
                    description: 'Simple command to test shell worker execution.  Will echo the passed arguments.',
                    script: 'test/echo.sh',
                    interpreter: 'none',
                    args: '',
                    work_units: 2,
                    created_at: createDate(2, 0),
                    updated_at: createDate(1, 3.5)
                })
            ]);
        });

    return Promise.all([promise1]);
};

function createDate(daysBefore, hoursBefore) {
    let date = new Date();

    date.setDate(date.getDate() - daysBefore);

    date.setHours(date.getHours() - hoursBefore);

    return date;
}
