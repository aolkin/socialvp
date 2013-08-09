#!/bin/bash

cd static
args="js/moment.min.js js/livestamp.min.js js/extlibs.js js/wschat.js js/plugins.js js/my.js --screw-ie8 -c hoist_funs=false,unused=false -o js/index.min.js --source-map js/index.min.js.map --source-map-url index.min.js.map -p 1"

if [ "$TERM" == "dumb" ]; then
    uglifyjs $args 2> /dev/null
else
    uglifyjs $args
fi
