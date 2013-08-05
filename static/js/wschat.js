/**
   WSChat Client

   @author Aaron Olkin

   @module WSChat
   @namespace client.core
*/

/**
   The WSChat constructor (bad style...possible refactoring candidate?)
   @class WSChat
   @constructor
*/
WSChat = function() {
    return {
	/**
	   The number of times this client has tried to connect to the server
	   since the last success.
	   @attribute retries
	   @readOnly
	   @type Number
	   @default 0
	*/
	retries: 0,
	/**
	   Whether this client is currently connected.
	   @attribute closed
	   @readOnly
	   @type Boolean
	   @default true
	*/
	closed: true,
	/**
	   Whether this client should log debug info to the browser console.
	   @property log
	   @type Boolean
	   @default false
	*/
	log: false,

	/**
	   Initializes a WSChat client and connects to the specified server.
	   @method init
	   @param {String} url The websocket url to connect to
	   @param {String} name The username to use
	   @param {Boolean} [noretry] Whether to attempt to recconnect if the connection is lost
	*/
	init: function(url,name,noretry) {
	    if (!this.closed) {
		return false; }
	    this.connected = false;
	    this.url = url;
	    this.name = name;
	    this.noretry = noretry===undefined?this.noretry:noretry;
	    /**
	       The underlying WebSocket instance that handles the raw communication.
	       @property socket
	       @private
	       @type WebSocket
	       @default new WebSocket(url);
	    */
	    this.socket = new WebSocket(url);
	    this.socket.wschat = this;
	    this.socket.onopen = function(e){
		this.wschat.retries = 0;
		this.wschat.closed = false;
	    };
	    this.socket.onmessage = function(e){
		ws = this.wschat;
		data = JSON.parse(e.data);
		if (ws.log) { console.log(data); }
		if (data.type == "init") {
		    ws.send({command:"identify",name:ws.name});
		} else if (data.type == "outcome") {
		    if (data.code == 300) {
			ws.onconnected(data.message);
		    } else if (data.code == 305) {
			ws.onerror(data.code,data.message);
		    } else if (data.code == 10) {
			this.close();
		    } else if (data.code == 400) {
			console.log("WSChat Protocol Error:",data.code,data.message);
		    } else if (data.code == 404) {
			ws.onerror(data.code,data.message,ws.lastmessage);
		    }
		} else if (data.type == "broadcast") {
		    ws.onbroadcast(data.message,data.from,e);
		} else if (data.type == "message") {
		    ws.onmessage(data.message,data.from,e);
		} else if (data.type == "quit") {
		    ws.onquit(data.who,e);
		}
	    };
	    this.socket.onerror = function(e){
		console.log("Websocket Error:",e)
		this.wschat.onwserror(e)
	    };
	    this.socket.onclose = function(e){
		ws = this.wschat;
		ws.closed = true;
		ws.onclose(e);
		if (!ws.noretry) {
		    ws.retries += 1;
		    setTimeout(function() {
			ws.init(ws.url,ws.name);
		    },Math.pow(2,ws.retries));
		}
	    };
	},
	/**
	   Sends a message to the specified client.
	   @method message
	   @param {String} message The message to send
	   @param {String} to The user to send the message to
	*/
	message: function(message,to) {
	    this.send({"command":"message","message":message,"to":to})
	},
	/**
	   Broadcasts a message to all connected clients.
	   @method broadcast
	   @param {String} message The message to send
	*/
	broadcast: function(message) {
	    this.send({"command":"broadcast","message":message})
	},
	/**
	   Performs the actual sending operation.
	   @method send
	   @private
	   @param {Object} data The object to be serialized and sent
	*/
	send: function(data) {
	    if (this.closed) { throw new Error("WSChat WebSocket is currently closed!"); }
	    this.lastmessage = data;
	    message = JSON.stringify(data);
	    this.socket.send(message);
	},
	/**
	   Closes the underlying websocket. However, unless the WSChat instance
	   is in noretry mode it will immediately attempt to reopen the connection.
	   @method close
	*/
	close: function() {
	    this.socket.close();
	},
	/**
	   Called on receipt of a message.
	   @event onmessage
	   @param {String} message The message received
	   @param {String} from The username of the person who sent the message
	   @param {Event} e The raw event
	*/
	onmessage: function(){},
	/**
	   Called on receipt of a broadcast.
	   @event onbroadcast
	   @param {String} message The message received
	   @param {String} from The username of the person who sent the broadcast
	   @param {Event} e The raw event
	*/
	onbroadcast: function(){},
	/**
	   Called on receipt of a WSChat error.
	   @event onerror
	   @param {Number} code The numeric identifier for the WSChat error
	   @param {String} message A nice error message string
	   @param {String} [lastmessage] The last message
	*/
	onerror: function(){},
	/**
	   Called when a websocket error occurs.
	   @event onwserror
	   @param {Event} e The raw event
	*/
	onwserror: function(){},
	/**
	   Called when a client disconnects from the server.
	   @event onquit
	   @param {String} who The username of the client who quit
	   @param {Event} e The raw event
	*/
	onquit: function(){},
	/**
	   Called when the websocket closes for any reason.
	   @event onclose
	   @param {Event} e The raw event
	*/
	onclose: function(){},
	/**
	   Called on a successful connection and identification to the server.
	   @event onconnected
	   @param {String} message The server welcome message (?)
	*/
	onconnected: function(){}
    };
};
