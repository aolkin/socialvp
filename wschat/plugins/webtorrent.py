"""
/**
    WebTorrent server plugin module
    @module webtorrent.py
    @namespace protocols
*/
"""

from tornado import websocket
import sys, json

wts = {}

class WebTorrentHandler(websocket.WebSocketHandler):
    """ The WebSocket handler plugin for the WebTorrent protocol.
    /**
        The WebTorrent Protocol specification and usage notes/documentation

        "Methods" describe messages sent by clients to the server.
        "Events" describe messages recieved by clients from the server.

        A username must be supplied to use thw WebTorrent protocol.
        Identification is accomplished using the "subprotocol" feature
        of WebSockets.

        *The parameters listed below should be supplied to the client side
        JavaScript WebSocket constructor.*
        @class WebTorrent
        @constructor
        @param {URL} url The appropriate WebSocket url
        @param {Array} names An array of possible usernames for this client
    */
    """

    def open(self):
        try:
            self.name
        except AttributeError:
            self.name = None

    def on_message(self,message):
        if not self.name:
            self.close()
        if message[0] == "\0":
            """
            /**
                If a message begins with an ASCII NUL ("\0"), it is interpreted
                as a binary message, otherwise it is assumed to be JSON.

                If a client tries to send a message without having identified
                properly (without specifying a username), they will simply be
                disconnected.
                @method Any Message
            */
            /**
                After the signifying first NUL byte, a binary message should
                specify the client(s) to forward the message to, terminated
                by another NUL. The entire message after that NUL will then
                be forwarded directly to the specified clients(s).

                *Sending binary messages to multiple clients at once has
                not been implemented yet.*
                @method Binary Message
                @param {NUL-terminated String} to The client to send to
                @param {Bytes} message The message to send
            */
            """
            message = message[1:]
            to = ""
            while message[0] != "\0":
                to += message[0]
                message = message[1:]
            print(repr(to))
            wts[to].write_message(message,True)
        else:
            """
            /**
                JSON methods
            */
            """
            data = json.loads(message)
            data["from"] = self.name
            if data["type"] == "tracking":
                for name,i in wts.items():
                    if name != self.name:
                        i.write_message(json.dumps(data))
            elif data["type"] == "request":
                to = wts.get(data["to"])
                if to:
                    to.write_message(json.dumps(data))
                else:
                    error = {"type":"error","error":"badclient"}
                    error["message"] = data
                    self.write_message(json.dumps(error))
        if message == "list":
            print(wts)
            sys.stdout.flush()

    def on_close(self):
        """
        /**
            When one client disconnects, all other clients recieve this
            message (for tracking purposes).
            @event JSON type:quit
            @param {String} who The name of the client that disconnected
        */
        """
        if self.name:
            del wts[self.name]
            for i in wts:
                wts[i].write_message(json.dumps(
                        {'type':'quit','who':self.name}))

    def select_subprotocol(self,sps):
        """
        /**
            The server will pick the first specified username that is
            available and return it, allowing the client to determine
            what username is in use through the "protocol" attribute
            of the JavaScript WebSocket. If none is available, the
            server will close the connection, although the client is
            free to try to connect again with the same or different
            usernames.

            @property WebSocket.protocol
            @type String
        */
        """
        for i in sps:
            if wts.get(i) == None:
                self.name = sps[0]
                wts[self.name] = self
                return self.name
        self.close()
        return False

handler = ('/webtorrent',WebTorrentHandler)
