#!/usr/bin/env bash

project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
is_cluster_job=$7
app="$8/dogDescriptor"
MCRROOT=$9

input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-prob.0.h5"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-prob.1.h5"
output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-prob"
output_file1="$output_file.0.txt"
output_file2="$output_file.1.txt"

log_file_base="$tile_relative_path"
log_file_base=${log_file_base//\//-}
log_file_cluster_1="/groups/mousebrainmicro/mousebrainmicro/LOG/2017-02-22/$log_file_base-cluster.0.txt"
log_file_cluster_2="/groups/mousebrainmicro/mousebrainmicro/LOG/2017-02-22/$log_file_base-cluster.1.txt"

LD_LIBRARY_PATH=.:${MCRROOT}/runtime/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/bin/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/sys/os/glnxa64;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/sys/opengl/lib/glnxa64;

export LD_LIBRARY_PATH;
echo LD_LIBRARY_PATH is ${LD_LIBRARY_PATH};

cmd1="${app} ${input_file1} ${output_file1} \"[11 11 11]\" \"[3.405500 3.405500 3.405500]\" \"[4.049845 4.049845 4.049845]\" \"[5 1019 5 1531 5 250]\" 4"

cmd2="${app} ${input_file2} ${output_file2} \"[11 11 11]\" \"[3.405500 3.405500 3.405500]\" \"[4.049845 4.049845 4.049845]\" \"[5 1019 5 1531 5 250]\" 4"

if [ ${is_cluster_job} -eq 0 ]
then
    eval ${cmd1}

    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 1"
    else
      echo "ilastik failed 1"
      exit $?
    fi

    eval ${cmd2}
    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 2"
      exit 0
    else
      echo "ilastik failed 2"
      exit $?
    fi
else
    ssh login1 "source /etc/profile; qsub -sync y -pe batch 1 -N ml-${tile_name} -j y -o ${log_file_cluster_1} -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd1}'"
    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 1"
    else
      echo "ilastik failed 1"
      exit $?
    fi

    ssh login1 "source /etc/profile; qsub -sync y -pe batch 41-N ml-${tile_name} -j y -o ${log_file_cluster_2} -b y -cwd -V -l d_rt=3600 -l broadwell=true '${cmd2}'"
    if [ $? -eq 0 ]
    then
      echo "Successfully executed ilastik 2"
      exit 0
    else
      echo "ilastik failed 2"
      exit $?
    fi
fi
