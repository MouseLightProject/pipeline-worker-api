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
app="$8/getDescriptorPerTile15b"
mcrRoot=$9

# Should be a standard project argument
log_path_base="/groups/mousebrainmicro/mousebrainmicro/LOG/pipeline"

# Compile derivatives
input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-desc.0.txt"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-desc.1.txt"

output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-desc.mat"

log_file_base=${tile_relative_path//\//-}
log_file_prefix="gd-"
log_file="${log_path_base}/${log_file_prefix}${log_file_base}.0.txt"

LD_LIBRARY_PATH=.:${mcrRoot}/runtime/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/bin/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/os/glnxa64;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/opengl/lib/glnxa64;

cmd="${app} ${input_file1} ${input_file2} ${output_file}"

if [ ${is_cluster_job} -eq 0 ]
then
    export LD_LIBRARY_PATH;

    eval ${cmd} &> ${log_file}

    if [ $? -eq 0 ]
    then
      echo "Completed descriptor merge."
      exit 0
    else
      echo "Failed descriptor merge."
      exit $?
    fi
else
    ssh login1 "source /etc/profile; export LD_LIBRARY_PATH=${LD_LIBRARY_PATH}; qsub -sync y -pe batch 1 -N ml-${tile_name} -j y -o ${log_file} -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd}'"
    if [ $? -eq 0 ]
    then
      echo "Completed descriptor merge (cluster)."
      exit 0
    else
      echo "Failed descriptor merge (cluster)."
      exit $?
    fi
fi
