
WSChat = function() {
    return {
	retries: 0,
	closed: true,
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
		this.wschat.closed = false;
	    };
	    this.socket.onmessage = function(e){
		ws = this.wschat;
		data = JSON.parse(e.data);
		console.log(data);
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
		} else {
		    ws.onmessage(e,e.data);
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
		if (!ws.noretry && ws.retries < 5) {
		    ws.retries += 1;
		    ws.init(ws.url,ws.name);
		}
	    };
	},
	message: function(message,to) {
	    this.send({"command":"broadcast","message":message,"to":to})
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
	onerror: function(){},
	onwserror: function(){},
	onclose: function(){},
	onconnected: function(){}
    };
};