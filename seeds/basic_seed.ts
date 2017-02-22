"use strict";

let env = process.env.NODE_ENV || "development";

env = process.env.KNEX_ENV || env;

if (env === "production" || env === "staging") {
    exports.seed = productionSeed();
} else {
    exports.seed = developmentSeed();
}

function productionSeed() {
    return (knex, Promise) => {
        // Deletes ALL existing entries
        let promise1 = knex("TaskDefinition").del()
            .then(() => {
                return Promise.all([
                    // Inserts seed entries
                    knex("TaskDefinition").insert({
                        id: "1ec76026-4ecc-4d25-9c6e-cdf992a05da3",
                        name: "Pixel Classifier Test",
                        description: "Calls classifier with test project.",
                        script: "tasks/pixel_shell.sh",
                        interpreter: "none",
                        args: "test/pixel_classifier_test",
                        work_units: 4,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "1161f8e6-29d5-44b0-b6a9-8d3e54d23292",
                        name: "Axon UInt16",
                        description: "Axon UInt16",
                        script: "tasks/axon-uint16.sh",
                        interpreter: "none",
                        args: "/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/axon-classifier",
                        work_units: 4,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "a9f21399-07c0-425c-86f6-6e4f45bb06b9",
                        name: "dogDescriptor",
                        description: "",
                        script: "tasks/dogDescriptor.sh",
                        interpreter: "none",
                        args: "/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/dogDescriptor /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90",
                        work_units: 2,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "3ba41d1c-13d0-4def-9b5b-54d940a0fa08",
                        name: "getDescriptorsForTile",
                        description: "",
                        script: "tasks/getDescriptorsForTile.sh",
                        interpreter: "none",
                        args: "/groups/mousebrainmicro/mousebrainmicro/Software/pipeline/apps/getDescriptorPerTile /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90",
                        work_units: 1,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "04b8313e-0e96-4194-9c06-22771acd3986",
                        name: "Echo",
                        description: "Simple command to test shell worker execution.  Will echo the passed arguments.",
                        script: "tasks/echo.sh",
                        interpreter: "none",
                        args: "",
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
        let promise1 = knex("TaskDefinition").del()
            .then(() => {
                return Promise.all([
                    // Inserts seed entries
                    knex("TaskDefinition").insert({
                        id: "1ec76026-4ecc-4d25-9c6e-cdf992a05da3",
                        name: "ilastik Pixel Classifier Test",
                        description: "Calls ilastik with test project.",
                        script: "tasks/pixel_shell.sh",
                        interpreter: "none",
                        args: "test/pixel_classifier_test",
                        work_units: 4,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "a9f21399-07c0-425c-86f6-6e4f45bb06b9",
                        name: "dogDescriptor",
                        description: "",
                        script: "tasks/dogDescriptor.sh",
                        interpreter: "none",
                        args: "/Volumes/Spare/Projects/MouseLight/Apps/Pipeline/dogDescriptor /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90",
                        work_units: 2,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "3ba41d1c-13d0-4def-9b5b-54d940a0fa08",
                        name: "getDescriptorsForTile",
                        description: "",
                        script: "tasks/getDescriptorsForTile.sh",
                        interpreter: "none",
                        args: "/Volumes/Spare/Projects/MouseLight/Apps/Pipeline/getDescriptorPerTile /groups/mousebrainmicro/mousebrainmicro/Software/mcr/v90",
                        work_units: 1,
                        created_at: createDate(3, 0)
                    }),
                    knex("TaskDefinition").insert({
                        id: "04b8313e-0e96-4194-9c06-22771acd3986",
                        name: "Echo",
                        description: "Simple command to test shell worker execution.  Will echo all arguments.",
                        script: "tasks/echo.sh",
                        interpreter: "none",
                        args: `"custom arg 1" "custom arg 2"`,
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
