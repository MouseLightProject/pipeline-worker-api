#!/usr/bin/env bash

if [ -z "$2" ]; then
    echo
else
    source ${2}
fi

if [ -z "$MACHINE_ID" ]; then
    echo "MACHINE_ID must be set or a script provided that sets it as the second argument."
    exit 1
fi

if [ -z "$WORK_UNIT_CAPACITY" ]; then
    echo "WORK_UNIT_CAPACITY must be set or a script provided that sets it as the second argument."
    exit 2
fi

if [ -z "$SERVER_HOST" ]; then
    echo "SERVER_HOST must be set or a script provided that sets it as the second argument."
    exit 3
fi

LAST_NODE_ENV=${NODE_ENV}

if [ -z "$1" ]; then
    export NODE_ENV=production
else
    export NODE_ENV=${1}
fi

nohup npm run dev &

NODE_ENV=${LAST_NODE_ENV}
