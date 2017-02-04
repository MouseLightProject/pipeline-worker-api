#!/usr/bin/env bash

project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
app="$7/dogDescriptor"
MCRROOT=$8

input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-prob.0.h5"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-prob.1.h5"
output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-prob"
output_file1="$output_file.0.txt"
output_file2="$output_file.1.txt"

LD_LIBRARY_PATH=.:${MCRROOT}/runtime/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/bin/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/sys/os/glnxa64;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${MCRROOT}/sys/opengl/lib/glnxa64;

export LD_LIBRARY_PATH;
echo LD_LIBRARY_PATH is ${LD_LIBRARY_PATH};

${app} ${input_file1} ${output_file1} "[11 11 11]" "[3.405500 3.405500 3.405500]" "[4.049845 4.049845 4.049845]" "[5 1019 5 1531 5 250]" 4

${app} ${input_file2} ${output_file2} "[11 11 11]" "[3.405500 3.405500 3.405500]" "[4.049845 4.049845 4.049845]" "[5 1019 5 1531 5 250]" 4

if [ $? -eq 0 ]
then
  echo "Successfully executed task"
  exit 0
else
  echo "task failed"
  exit 1
fi

