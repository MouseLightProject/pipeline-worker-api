'use strict';

let env = process.env.NODE_ENV || "development";

env = process.env.KNEX_ENV || env;

if (env === "production") {
    exports.seed = productionSeed();
} else {
    exports.seed = developmentSeed();
}

function productionSeed() {
    return (knex, Promise) => {
        // Deletes ALL existing entries
        let promise1 = knex('TaskDefinition').del()
            .then(() => {
                return Promise.all([
                    // Inserts seed entries
                    knex('TaskDefinition').insert({
                        id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3'.toLocaleLowerCase(),
                        name: 'Pixel Classifier Test',
                        description: 'Calls classifier with test project.',
                        script: 'tasks/pixel_shell.sh',
                        interpreter: 'none',
                        args: 'test/pixel_classifier_test',
                        work_units: 4,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: '1161F8E6-29D5-44B0-B6A9-8D3E54D23292'.toLocaleLowerCase(),
                        name: 'Axon UInt16',
                        description: 'Axon UInt16',
                        script: 'tasks/axon-uint16.sh',
                        interpreter: 'none',
                        args: '/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/axon-classifier',
                        work_units: 10,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: 'A9F21399-07C0-425C-86F6-6E4F45BB06B9'.toLocaleLowerCase(),
                        name: 'dogDescriptor',
                        description: '',
                        script: 'tasks/dogDescriptor.sh',
                        interpreter: 'none',
                        args: '/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/dogDescriptor /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90',
                        work_units: 2,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: '3BA41D1C-13D0-4DEF-9B5B-54D940A0FA08'.toLocaleLowerCase(),
                        name: 'getDescriptorsForTile',
                        description: '',
                        script: 'tasks/getDescriptorsForTile.sh',
                        interpreter: 'none',
                        args: '/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/getDescriptorPerTile /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90',
                        work_units: 1,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: '04B8313E-0E96-4194-9C06-22771ACD3986'.toLocaleLowerCase(),
                        name: 'Echo',
                        description: 'Simple command to test shell worker execution.  Will echo the passed arguments.',
                        script: 'tasks/echo.sh',
                        interpreter: 'none',
                        args: '',
                        work_units: 0,
                        created_at: createDate(2, 0),
                        updated_at: createDate(1, 3.5)
                    })
                ]);
            });

        return Promise.all([promise1]);
    };
}

function developmentSeed() {
    return (knex, Promise) => {
        // Deletes ALL existing entries
        let promise1 = knex('TaskDefinition').del()
            .then(() => {
                return Promise.all([
                    // Inserts seed entries
                    knex('TaskDefinition').insert({
                        id: '1EC76026-4ECC-4D25-9C6E-CDF992A05DA3'.toLocaleLowerCase(),
                        name: 'ilastik Pixel Classifier Test',
                        description: 'Calls ilastik with test project.',
                        script: 'tasks/pixel_shell.sh',
                        interpreter: 'none',
                        args: 'test/pixel_classifier_test',
                        work_units: 4,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: 'A9F21399-07C0-425C-86F6-6E4F45BB06B9'.toLocaleLowerCase(),
                        name: 'dogDescriptor',
                        description: '',
                        script: 'tasks/dogDescriptor.sh',
                        interpreter: 'none',
                        args: '/Volumes/Spare/Projects/MouseLight/Apps/Pipeline/dogDescriptor /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90',
                        work_units: 2,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: '3BA41D1C-13D0-4DEF-9B5B-54D940A0FA08'.toLocaleLowerCase(),
                        name: 'getDescriptorsForTile',
                        description: '',
                        script: 'tasks/getDescriptorsForTile.sh',
                        interpreter: 'none',
                        args: '/Volumes/Spare/Projects/MouseLight/Apps/Pipeline/getDescriptorPerTile /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90',
                        work_units: 1,
                        created_at: createDate(3, 0)
                    }),
                    knex('TaskDefinition').insert({
                        id: '04B8313E-0E96-4194-9C06-22771ACD3986'.toLocaleLowerCase(),
                        name: 'Echo',
                        description: 'Simple command to test shell worker execution.  Will echo all arguments.',
                        script: 'tasks/echo.sh',
                        interpreter: 'none',
                        args: '"custom arg 1" "custom arg 2"',
                        work_units: 0,
                        created_at: createDate(2, 0),
                        updated_at: createDate(1, 3.5)
                    })
                ]);
            });

        return Promise.all([promise1]);
    };
}

function createDate(daysBefore, hoursBefore) {
    let date = new Date();

    date.setDate(date.getDate() - daysBefore);

    date.setHours(date.getHours() - hoursBefore);

    return date;
}
