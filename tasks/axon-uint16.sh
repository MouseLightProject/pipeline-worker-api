#!/usr/bin/env bash

# Standard arguments passed to all tasks.
project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
is_cluster_job=$7

# Custom task arguments defined by task definition
ilastik_project="$8/axon_uint16.ilp"

# Should be a standard project argument
log_path_base="/groups/mousebrainmicro/mousebrainmicro/LOG/pipeline"

# Compile derivatives
input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-ngc.0.tif"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-ngc.1.tif"

output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-prob"
output_file1="$output_file.0.h5"
output_file2="$output_file.1.h5"

log_file_base=${tile_relative_path//\//-}
log_file_prefix="ax-"
log_file_1="${log_path_base}/${log_file_prefix}${log_file_base}.0.txt"
log_file_2="${log_path_base}/${log_file_prefix}${log_file_base}.1.txt"

output_format="hdf5"

# Default location on test and production machines.  Can also export IL_PREFIX in worker profile script (typically id.sh).
if [ -z "$IL_PREFIX" ]
then
  if [ "$(uname)" == "Darwin" ]
  then
    IL_PREFIX=/Volumes/Spare/Projects/MouseLight/Classifier/ilastik/ilastik-1.1.8-OSX.app/Contents/ilastik-release
  else
    IL_PREFIX=/groups/mousebrainmicro/mousebrainmicro/cluster/software/ilastik-1.1.9-Linux
  fi
fi

cmd1="${IL_PREFIX}/bin/python ${IL_PREFIX}/ilastik-meta/ilastik/ilastik.py --logfile=${log_file_1} --headless --cutout_subregion=\"[(None,None,None,0),(None,None,None,1)]\" --project=\"${ilastik_project}\" --output_filename_format=\"${output_file1}\" --output_format=\"${output_format}\" \"$input_file1\""
cmd2="${IL_PREFIX}/bin/python ${IL_PREFIX}/ilastik-meta/ilastik/ilastik.py --logfile=${log_file_2} --headless --cutout_subregion=\"[(None,None,None,0),(None,None,None,1)]\" --project=\"${ilastik_project}\" --output_filename_format=\"${output_file2}\" --output_format=\"${output_format}\" \"$input_file2\""

if [ ${is_cluster_job} -eq 0 ]
then
    export LD_LIBRARY_PATH=""
    export PYTHONPATH=""
    export QT_PLUGIN_PATH=${IL_PREFIX}/plugins

    export LAZYFLOW_THREADS=18
    export LAZYFLOW_TOTAL_RAM_MB=200000

    eval ${cmd1}

    result=$?

    if [ ${result} -eq 0 ]
    then
      echo "Completed classifier for channel 0."
    else
      echo "Failed classifier for channel 0."
      exit ${result}
    fi

    eval ${cmd2}

    result=$?

    if [ ${result} -eq 0 ]
    then
      echo "Completed classifier for channel 1."
      exit 0
    else
      echo "Failed classifier for channel 1."
      exit ${result}
    fi
else
    LAZYFLOW_THREADS=4
    LAZYFLOW_TOTAL_RAM_MB=60000

    cluster_exports="export LAZYFLOW_THREADS=${LAZYFLOW_THREADS}; export LAZYFLOW_TOTAL_RAM_MB=${LAZYFLOW_TOTAL_RAM_MB}; LD_LIBRARY_PATH=\"\"; PYTHONPATH=\"\"; QT_PLUGIN_PATH=${IL_PREFIX}/plugins"

    ssh login1 "source /etc/profile; ${cluster_exports}; qsub -sync y -pe batch 4 -N ml-ax-${tile_name} -j y -o /dev/null -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd1}'"

    result=$?

    if [ ${result} -eq 0 ]
    then
      echo "Completed classifier for channel 0 (cluster)."
    else
      echo "Failed classifier for channel 0 (cluster)."
      exit ${result}
    fi

    ssh login1 "source /etc/profile; ${cluster_exports}; qsub -sync y -pe batch 4 -N ml-ax-${tile_name} -j y -o /dev/null -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd2}'"

    result=$?

    if [ ${result} -eq 0 ]
    then
      echo "Completed classifier for channel 1 (cluster)."
      exit 0
    else
      echo "Failed classifier for channel 1 (cluster)."
      exit ${result}
    fi
fi
