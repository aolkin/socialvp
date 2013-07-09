#!/usr/bin/env python3

from tornado import websocket, web, ioloop
import json, sys, os, time

CODES = {
    10:"Please identify yourself!",
    300:"Identified successfully!",
    305:"Client with that name already exists!",
    400:"Missing required request field!",
    404:"No client with that name is currently connected!"
}

def outcome(successful,code,message=None):
    if code and not message:
        message = CODES[code]
    return json.dumps({"type":"outcome","success":successful,"message":message,"code":code})

ws = {}

class WSList(web.RequestHandler):
    def get(self):
        print(ws.keys())
        sys.stdout.flush();sys.stderr.flush();
        self.write("WebSockets printed to stdout")

class WSHandler(websocket.WebSocketHandler):
    def checkattr(self,obj,attr):
        if attr in obj:
            return True
        else:
            self.write_message(outcome(False,400,"Missing '{}' field!".format(attr)))
            return False

    def open(self):
        time.sleep(0.5)
        self.write_message(json.dumps({"type":"init","message":"Please identify to recieve messages."}))

    def on_message(self,message):
        sys.stdout.flush();sys.stderr.flush();
        obj = json.loads(message)
        if not self.checkattr(obj,"command"): return None
        if obj["command"] == "identify":
            if not self.checkattr(obj,"name"): return None
            print("Joining: {} [Current Clients: {}]".format(obj["name"],",".join(ws.keys())))
            if obj["name"] in ws:
                self.write_message(outcome(False,305))
            else:
                self.name = obj["name"]
                ws[self.name] = self
                self.write_message(outcome(True,300))
        elif not hasattr(self,"name"):
            self.write_message(outcome(False,10))
        elif obj["command"] == "broadcast":
            if not self.checkattr(obj,"message"): return None
            for i in ws:
                if i != self.name:
                    ws[i].write_message(json.dumps({'type':'broadcast',
                                                    'from':self.name,
                                                    'message':obj["message"]}))
        elif obj["command"] == "message":
            if not self.checkattr(obj,"message"): return None
            if not self.checkattr(obj,"to"): return None
            to = ws.get(obj["to"])
            if not to:
                self.write_message(outcome(False,404))
            else:
                to.write_message(json.dumps({'type':'message',
                                             'from':self.name,
                                             'message':obj["message"]}))

    def on_close(self):
        if hasattr(self,"name"):
            del ws[self.name]
            for i in ws:
                ws[i].write_message(json.dumps({'type': 'quit',
                                                'who': self.name}))
    
staticpath = "static"
while not os.path.isdir(staticpath):
    staticpath = "../"+staticpath
    if len(staticpath.split("/") > 6):
        raise IOError("Static files directory not found! (reached search limit)")

app = web.Application([
        (r'/()', web.StaticFileHandler, {"path":staticpath+"/index.html"}),
        (r'/wschat',WSHandler),
        (r'/wslist',WSList),
        (r'/(.+)', web.StaticFileHandler, {"path":staticpath})])


def main():
    pidfn = "wss.pid"
    if os.path.exists(pidfn):
        fd = open(pidfn)
        pid = fd.read()
        fd.close()
        os.unlink(pidfn)
    else:
        pid = None
    if "stop" in sys.argv:
        if pid:
            print("Stopping WebSocket Server...")
            os.kill(int(pid),15)
        exit(0)
    if pid and os.path.exists("/proc/{}".format(pid)):
            print("This server is already running! Restarting...")
            os.kill(int(pid),15)


    print("Loading Tornado WebSocket Server...")
    #print("\x1b]2;Python Tornado WebSocket Server\x07")

    print("WebSocket Server Root Process PID: {}".format(os.getpid()))

    try:
        host, colon, port = sys.argv[1].rpartition(":")
        port = int(port)
    except IndexError as err:
        print("No host/port specified! Must specify at least a port.")
        exit(2)
    except ValueError as err:
        print("Invalid Port Argument!")
        exit(1)

    fd = open(pidfn,"w")
    fd.write("{}".format(os.getpid()))
    fd.close()

    sys.stdout.flush();sys.stderr.flush();
    app.listen(port,host)
    ioloop.IOLoop.instance().start()

if __name__ == "__main__":
    main()
