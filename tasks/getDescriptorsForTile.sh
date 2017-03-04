#!/usr/bin/env bash

project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
is_cluster_job=$7
app="$8/getDescriptorPerTile15b"
mcrRoot=$9

input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-prob.0.txt"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-prob.1.txt"
output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-desc.mat"

log_file_base="$tile_relative_path"
log_file_base=${log_file_base//\//-}
log_file_cluster_1="/groups/mousebrainmicro/mousebrainmicro/LOG/2017-02-22/$log_file_base-cluster.0.txt"
log_file_cluster_2="/groups/mousebrainmicro/mousebrainmicro/LOG/2017-02-22/$log_file_base-cluster.1.txt"

LD_LIBRARY_PATH=.:${mcrRoot}/runtime/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/bin/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/os/glnxa64;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/opengl/lib/glnxa64;

export LD_LIBRARY_PATH;
echo LD_LIBRARY_PATH is ${LD_LIBRARY_PATH};

cmd="${app} ${input_file1} ${input_file2} ${output_file}"

if [ ${is_cluster_job} -eq 0 ]
then
    eval ${cmd1}

    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 1"
      exit 0
    else
      echo "ilastik failed 1"
      exit $?
    fi
else
    ssh login1 "source /etc/profile; qsub -sync y -pe batch 1 -N ml-${tile_name} -j y -o ${log_file_cluster_1} -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd1}'"
    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 1"
      exit 0
    else
      echo "ilastik failed 1"
      exit $?
    fi
fi
