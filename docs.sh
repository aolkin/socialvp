#!/bin/bash

if [ "$TERM" == "dumb" ]; then
    extra="-q -N"
else
    verbose=-v
fi

yuidoc --themedir ./yuidoc -c yuidoc/yuidoc.json -e .js,.py,.docs $extra

outdir="/media/Media/gitrepos/docs/Social Video Player/"
rm -r "$outdir"
mkdir -p "$outdir"
cp -r apidocs/* "$outdir"
