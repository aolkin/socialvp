#!/usr/bin/env python3

# Author: Aaron Olkin
#
# The servers in this module use separate processes to handle requests...

import socket, ssl, os, sys
from http.server import HTTPServer,SimpleHTTPRequestHandler,BaseHTTPRequestHandler
from socketserver import ForkingMixIn

class SecureServer (ForkingMixIn,HTTPServer):
    def __init__(self,host="127.0.0.1",port=443,handler=SimpleHTTPRequestHandler):
        """Creates a new SecureServer object.
        The default host only allows requests from localhost.
        The default port only works with root access."""

        self.address = host, port
        HTTPServer.__init__(self,self.address,handler)
        self.socket = ssl.wrap_socket(self.socket,certfile="server/cert.pem",server_side=True)

class Server (ForkingMixIn,HTTPServer):
    def __init__(self,host="127.0.0.1",port=80,handler=SimpleHTTPRequestHandler):
        """Creates a new SecureServer object.
        The default host only allows requests from localhost.
        The default port only works with root access."""

        self.address = host, port
        HTTPServer.__init__(self,self.address,handler)


if __name__ == "__main__":
    sys.path.append("./server") # Changes working directory to root "phs-votes" folder
    
    s,ss = None,None
    host =  ""
    try:
        if os.geteuid() == 0:
            ss = SecureServer(host)
            s = Server(host)
        else:
            #ss = SecureServer(host,4443)
            s = Server(host,8000)
        s.serve_forever()
        #ss.serve_forever()
    finally:
        if s:
            s.shutdown()
        if ss:
            ss.shutdown()
