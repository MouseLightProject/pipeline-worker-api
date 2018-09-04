#!/usr/bin/env bash

# All are optional based on whether services are running as defaults except for PIPELINE_WORKER_ID which must be defined
# as a UUID (e.g., 1bcc812d-97ce-4b14-ad48-5c3c9b9b416f).

# However, typically PIPELINE_CORE_SERVICES_HOST and PIPELINE_API_HOST at minimum need appropriate values.

export PIPELINE_WORKER_ID=
export PIPELINE_WORKER_API_PORT=

export PIPELINE_CORE_SERVICES_HOST=

export PIPELINE_DATABASE_PORT=
export PIPELINE_MESSAGE_PORT=

export PIPELINE_API_HOST=
export PIPELINE_API_PORT=

export PIPELINE_DATABASE_USER=
export PIPELINE_DATABASE_PASS=

export PIPELINE_WORKER_CLUSTER_HOST=
