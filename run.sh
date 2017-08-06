#!/usr/bin/env bash

if [ "$#" -gt 1 ]; then
    source ${1}
else
    if [ -a "id.sh" ]; then
        source "id.sh"
    fi
fi

if [ -z "$SERVER_HOST" ]; then
    echo "SERVER_HOST must be set or a script provided that sets it as the second argument."
    exit 1
fi

nohup npm run dev &
