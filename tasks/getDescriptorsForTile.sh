#!/usr/bin/env bash

project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
app="$7/getDescriptorPerTile15b"
mcrRoot=$8

input_file1="$pipeline_input_root/$tile_relative_path/$tile_name-prob.0.txt"
input_file2="$pipeline_input_root/$tile_relative_path/$tile_name-prob.1.txt"
output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="-desc.mat"

LD_LIBRARY_PATH=.:${mcrRoot}/runtime/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/bin/glnxa64 ;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/os/glnxa64;
LD_LIBRARY_PATH=${LD_LIBRARY_PATH}:${mcrRoot}/sys/opengl/lib/glnxa64;

export LD_LIBRARY_PATH;
echo LD_LIBRARY_PATH is ${LD_LIBRARY_PATH};

${app} ${input_file1} ${input_file2} ${output_file}

if [ $? -eq 0 ]
then
  echo "Successfully executed task"
  exit 0
else
  echo "task failed"
  exit 1
fi

