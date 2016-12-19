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

export PREFIX=/Volumes/Spare/Projects/MouseLight/Classifier/ilastik/ilastik-1.1.8-OSX.app/Contents/ilastik-release

# Do not use the user's previous LD_LIBRARY_PATH settings because they can cause conflicts.
# Start with an empty LD_LIBRARY_PATH
export LD_LIBRARY_PATH=""

# Similarly, clear PYTHONPATH
export PYTHONPATH=""

# Do not use the user's own QT_PLUGIN_PATH, which can cause conflicts with our QT build.
# This is especially important on KDE, which is uses its own version of QT and may conflict.
export QT_PLUGIN_PATH=$PREFIX/plugins

$PREFIX/bin/python $PREFIX/ilastik-meta/ilastik/ilastik.py --headless --project="$ilastik_project" --output_filename_format="$output_file" --output_format=hdf5 "$input_file"

if [ $? -eq 0 ]
then
  echo "Successfully executed ilastik"
  exit 0
else
  echo "ilastik failed"
  exit 1
fi

