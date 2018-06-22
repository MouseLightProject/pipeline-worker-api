#!/usr/bin/env bash

migrateWorkerDatabase()
{
    SUCCESS=1

    while [ ${SUCCESS} -ne 0 ]; do
        echo "Migrate worker database"

        sequelize db:migrate
        SUCCESS=$?

        if [ ${SUCCESS} -ne 0 ]; then
            echo "Migration failed - waiting 5 seconds"
            sleep 5s
        fi
    done

    echo "Migrated worker database"
}

echo "Migrate for worker database."

migrateWorkerDatabase

exit 0
