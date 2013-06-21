#!/usr/bin/env python3

from tornado import websocket, web, ioloop
import json, sys, os

def gen_error(message):
    return json.dumps({"success":False,"error":message})

ws = {}

class WSHandler(websocket.WebSocketHandler):
    def open(self):
        pass

    def on_message(self,message):
        obj = json.loads(message)
        if obj["command"] == "identify":
            self.name = obj["name"]
            if ws.get(self.name):
                self.write_message(gen_error("Client with that name already exists!"))
            else:
                ws[self.name] = self
        elif not hasattr(self,"name"):
            self.write_message(gen_error("Please identify yourself!"))
        elif obj["command"] == "broadcast":
            for i in ws:
                if i != self.name:
                    ws[i].write_message(json.dumps({'type':'broadcast',
                                                    'message':obj["message"]}))

    def on_close(self):
        del ws[self.name]
    

app = web.Application([(r'/.*',WSHandler)])


def main():
    print("Loading Tornado WebSocket Server...")
    #print("\x1b]2;Python Tornado WebSocket Server\x07")

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
    print("WebSocket Server Root Process PID: {}".format(os.getpid()))

    app.listen(port,host)
    ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()
