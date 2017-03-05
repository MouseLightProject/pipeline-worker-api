#!/usr/bin/env bash

LAST_NODE_ENV=${NODE_ENV}

if [ "$#" -gt 1 ]; then
    export NODE_ENV=${1}
    source ${2}
elif [ "$#" -gt 0 ]; then
    export NODE_ENV=${1}
    if [ -a "id.sh" ]; then
        source "id.sh"
    fi
fi

if [ -z "$NODE_ENV" ]; then
    NODE_ENV=production
fi

if [ -z "$SERVER_HOST" ]; then
    echo "SERVER_HOST must be set or a script provided that sets it as the second argument."
    NODE_ENV=${LAST_NODE_ENV}
    exit 1
fi

nohup npm run dev &

NODE_ENV=${LAST_NODE_ENV}
