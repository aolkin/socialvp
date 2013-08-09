#!/bin/bash

/usr/bin/nohup python3 wschat/server.py 0.0.0.0:9876 >server.log &
sleep 0.2
