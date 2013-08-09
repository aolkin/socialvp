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
        The WebTorrent Protocol Specification and Documentation
        ==================================================================

        "Methods" describe messages sent by clients to the server.
        "Events" describe messages received by clients from the server.

        A username must be supplied to use the WebTorrent protocol.
        Identification is accomplished using the "subprotocol" feature
        of WebSockets.

        *(This protocol is in early alpha and is subject to change)*
        
        How WebTorrent Works
        ------------------------------------------------------------------
        WebTorrent allows files to be transmitted between clients by breaking
        up files and sending individual 2MB (that size is not finalized yet)
        blocks at a time. When a client would like to share a file, it must
        assign it a unique ID no longer than 64 characters (Usually the
        filename, or a hash of it) and share that ID with the receiving client.
        The receiving client then sends a tracking request broadcast, and the
        current owner of the file must respond with a "request" (oops)
        containing more detailed information about the file. The receiving
        client should then have enough information to begin requesting file
        blocks.
        
        At any point, a client may send a "request" with a file id and block
        number to any other client. If that client has that block of that
        file, it should respond with a binary message to the requesting
        client containing a 64 character bytestring of the file ID
        followed by a two byte unsigned integer specifying the file block,
        and then the actual data of that block. If the client does not have
        that block, it may ignore the request. It is up to the requesting
        client to keep track of what blocks it has and what it needs.

        <br />
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
        if message[0] == 0 or type(message) == bytes:
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
            /**
                When one client sends a binary message, the receiver will
                receive the exact message, but with no "from" information.
                @event Binary Message
                @param {Bytes} message The sent message
            */
            """
            message = message[1:]
            to = ""
            while message[0] != 0:
                to += chr(message[0])
                message = message[1:]
            try:
                wts[to].write_message(message,True)
            except KeyError as err:
                pass
        else:
            """
            /**
                JSON messages can be either fileblock requests or tracking
                broadcasts.
                @method JSON Message
                @param {String} type Either "tracking" or "request"
            */
            /**
                A "tracking" message will be broadcast to all connected
                clients as is, except a "from" parameter will be added to
                specify the sender.
                @method JSON type:tracking
            */
            /**
                A "request" message will be forwarded as is to the specified
                client, with a "from" parameter added to specify the sender.
                If the specified receiver is invalid, a JSON message of type
                "error" and error "badclient", with a "message" attribute
                containing the original message, will be sent.
                @method JSON type:request
                @param {String} to The client to send to
            */
            """
            try:
                data = json.loads(message)
            except TypeError as err:
                print(repr(err))
                print(type(message),'"',message,'"')
                return False
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
            """
            /**
                If the sent message is the string "list", a list of
                connected clients will be printed to stdout.
                @method list
                @private
            */
            """
            print(wts)
            sys.stdout.flush()

    def on_close(self):
        """
        /**
            When one client disconnects, all other clients receive this
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
