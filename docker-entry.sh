#!/usr/bin/env bash

logName=$(date '+%Y-%m-%d%H-%M-%S');

if [ ! -z "${PIPELINE_PERFORM_MIGRATION}" ]; then
    ./migrate.sh &> /var/log/pipeline/worker-${logName}.log
fi

export DEBUG=pipeline*

node server/pipelineWorkerApp.js &> /var/log/pipeline/worker-${logName}.log

# sleep infinity
