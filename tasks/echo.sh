#!/usr/bin/env bash

echo $@

DUR=$(($RANDOM % 10 + 4))

sleep ${DUR}

exit 0
