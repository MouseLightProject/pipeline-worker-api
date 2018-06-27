#!/usr/bin/env bash

logName=$(date '+%Y-%m-%d_%H-%M-%S');

mkdir -p ~/var/log/pipeline

./migrate.sh &> /var/log/pipeline/worker-${logName}.log

wait

export DEBUG=pipeline*

node server/pipelineWorkerApp.js &> /var/log/pipeline/worker-${logName}.log

