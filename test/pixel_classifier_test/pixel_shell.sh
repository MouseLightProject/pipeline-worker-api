#!/bin/bash
project_name=$1
project_root=$2
pipeline_input_root=$3
pipeline_output_root=$4
tile_relative_path=$5
tile_name=$6
channel=$7
ilastik_project="$8/PixelTest.ilp"

input_file="$pipeline_input_root/$tile_relative_path/$tile_name-ngc.$channel.tif"
output_file="$pipeline_output_root/$tile_relative_path/$tile_name"
output_file+="_Probabilities"

/Volumes/Spare/Projects/MouseLight/Classifier/ilastik/ilastik-1.1.8-OSX.app/Contents/ilastik-release/run_ilastik.sh --headless --project="$ilastik_project" --output_filename_format="$output_file" --output_format=hdf5 "$input_file"

if [ $? -eq 0 ]
then
  echo "Successfully executed ilastik"
  exit 0
else
  echo "ilastik failed"
  exit 1
fi

