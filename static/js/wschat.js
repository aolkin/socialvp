
WSChat = function() {
    return {
	retries: 0,
	closed: true,
	log: false,
	init: function(url,name,noretry) {
	    if (!this.closed) {
		return false; }
	    this.connected = false;
	    this.url = url;
	    this.name = name;
	    this.noretry = noretry===undefined?this.noretry:noretry;
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
	message: function(message,to) {
	    this.send({"command":"message","message":message,"to":to})
	},
	broadcast: function(message) {
	    this.send({"command":"broadcast","message":message})
	},
	send: function(data) {
	    if (this.closed) { throw new Error("WSChat WebSocket is currently closed!"); }
	    this.lastmessage = data;
	    message = JSON.stringify(data);
	    this.socket.send(message);
	},
	close: function() {
	    this.socket.close();
	},
	onmessage: function(){},
	onbroadcast: function(){},
	onerror: function(){},
	onwserror: function(){},
	onquit: function(){},
	onclose: function(){},
	onconnected: function(){}
    };
};