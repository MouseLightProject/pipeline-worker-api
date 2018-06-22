#!/usr/bin/env bash

if [ -a "options.sh" ]; then
    source "options.sh"
fi

./migrate.sh

export DEBUG=pipeline*

nohup node server/pipelineWorkerApp.js &

sleep 3

chmod 775 nohup.out
