# Pipeline Worker API Service

## Quick Notes
Starting this services generally requires at least the following be defined:
* `PIPELINE_WORKER_ID` (uuid string)
* `PIPELINE_API_HOST` (hostname or ip)
* `PIPELINE_API_PORT` if not the default

By allowing the system to generate the worker id 

Running standalone, `run.sh` will automatically load `options.sh` if present and these values can be defined there as
one possibility.

For containers, these can be defined via the -e flag, or in a Compose file, for example.

If the worker is not running in the same container environment as the postgres server, the following must
also be defined:
* `PIPELINE_CORE_SERVICES_HOST` (default pipeline-db)

and possibly
* `PIPELINE_DATABASE_PORT` (default 5432)

If you are running multiple workers on the same machine, additional workers must modify:
* `PIPELINE_WORKER_API_PORT`

To override the hostname as the worker name, use
* `PIPELINE_WORKER_NAME`

### Local Process Manager
For workers that will process locally (vs. cluster submissions) PM2 is used by default, however it is not installed as a local 
node module by default.  If installed as part of your global node install, you can access any of the global modules through na
export such as 

`NODE_PATH=~/.nvm/versions/node/v7.10.0/lib/node_modules`

in the example when using NVM and node 7.10.0.
