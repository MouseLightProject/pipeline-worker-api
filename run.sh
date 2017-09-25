#!/usr/bin/env bash

if [ -a "options.sh" ]; then
    source "options.sh"
fi

# Default is "pipeline-api" which is mostly guaranteed to not be correct when running standalone.
if [ -z "${PIPELINE_API_HOST}" ]; then
    echo "PIPELINE_API_HOST must be set."
    exit 1
fi

./migrate.sh

nohup npm run devel &

chmod 664 nohup.out
