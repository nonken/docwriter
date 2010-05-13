#! /bin/bash

echo "Building docs"

DOC_DIR=$1

if [ -z $DOC_DIR ]; then
    echo "Please provide the documentation directory"
    exit 1
fi;

cd $DOC_DIR
make html
echo "Done"
exit 0
