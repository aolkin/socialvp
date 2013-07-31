#!/bin/bash

js=static/js

uglifyjs $js/moment.min.js $js/livestamp.min.js $js/wschat.js $js/plugins.js $js/localvideo.js $js/my.js --screw-ie8 -c -m -o static/js/index.min.js
