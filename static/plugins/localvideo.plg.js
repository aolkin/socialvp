new Plugin(
    function LocalVideo(){
	this.client = Worker("plugins/webtorrent.worker.js");
	this.client.onmessage = $.proxy(this.workerMessage,this);
	this.client.postMessage;
    }, {
	workerMessage: function(e) {
	    console.log(e.data);
	}
    }
);
