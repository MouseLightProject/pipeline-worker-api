#!/usr/bin/env bash

echo "Migrate local sqlite cache"

knex migrate:latest
