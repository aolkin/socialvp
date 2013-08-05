#!/bin/bash

js=static/js
args="$js/moment.min.js $js/livestamp.min.js $js/wschat.js $js/plugins.js $js/my.js --screw-ie8 -c hoist_funs=false,unused=false -o static/js/index.min.js --source-map static/js/index.min.js.map"

if [ "$TERM" == "dumb" ]; then
    uglifyjs $args 2> /dev/null
else
    uglifyjs $args
fi
