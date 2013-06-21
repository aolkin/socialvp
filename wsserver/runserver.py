#!/usr/bin/env python3

# Author: Aaron Olkin

import sys, os

sys.path.append("wsserver")
import server

from hashlib import sha1
from base64 import b64encode,b64decode

WS_GUID = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
class WebSocketHandler(server.BaseHTTPRequestHandler):
    server_version = "WebSocketServer/0.1"
    def do_GET(self):
        #self.log_message("Handler PID: {}".format(os.getpid()))
        if not (self.headers.get("Upgrade") == "websocket" and
                self.headers.get("Connection") == "Upgrade"):
            self.send_error(426,"Upgrade to WebSocket required here.")
            return False
        self.send_response(101,"Switching Protocols")
        key = b64decode(self.headers.get("Sec-WebSocket-Key"))+WS_GUID
        hashed_key = sha1(key).digest()
        self.log_message(b64encode(hashed_key).decode())
        self.send_header("Upgrade","websocket")
        self.send_header("Connection","Upgrade")
        self.send_header("Sec-Websocket-Accept",b64encode(hashed_key).decode())
        self.end_headers(); self.flush_headers()
        
            
def main():

    print("Loading WebSocket...")
    print("\x1b]2;Python WebSocket Server\x07")

    try:
        host, colon, port = sys.argv[1].rpartition(":")
        port = int(port)
    except KeyError as err:
        print("No host/port specified! Must specify at least a port.")
        exit(2)
    except ValueError as err:
        print("Invalid Port Argument!")
        exit(1)

    pidfn = "wss.pid"
    if os.path.exists(pidfn):
        fd = open(pidfn)
        pid = fd.read()
        fd.close()
        if os.path.exists("/proc/{}".format(pid)):
            print("This server is already running! Restarting...")
            os.kill(int(pid),15)
    fd = open(pidfn,"w")
    fd.write("{}".format(os.getpid()))
    fd.close()

    webserver = server.Server(host,port,WebSocketHandler)

    print("WebSocket Server Root Process PID: {}".format(os.getpid()))

    try:
        webserver.serve_forever()
    except KeyboardInterrupt:
        webserver.socket.close()

if __name__ == "__main__":
    main()
