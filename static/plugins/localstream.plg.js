localstream = {};

localstream.ellipsesTimer = function() {
    $(".localstream-loading-ellipses").each(function(index,el){
	current = localstream.ellipses.indexOf($(el).text())+1;
	if (current > 3) { current = 0; }
	$(el).text(localstream.ellipses[current]);
    });
    setTimeout(localstream.ellipsesTimer,700);
};
localstream.ellipses = ['', '.', '..', '...'];

LocalStreamSignalingChannel = new Plugin(
    function LSSC(self,id) {
	this.register("wsBroadcast",this.receive);
	this.register("wsMessage",this.receive);
	this.self = self?self:this;
	this.id = id?id:"LSSC";
    }, {
	receive: function(type,args) {
	    if (args[0].type == "plugin"+this.id) {
		from = args[1];
		message = args[0].data;
		func = type=="wsBroadcast"?this.onbroadcast:this.onmessage;
		func.call(this.self,message,from);
	    }
	},
	sendBroadcast: function(message) {
	    svp.ws.broadcast({type:"plugin"+this.id,data:message,id:svp.video.id});
	},
	sendMessage: function(message,to) {
	    svp.ws.message({type:"plugin"+this.id,data:message});
	},
	onbroadcast: function(message,from) {console.log(arguments);},
	onmessage: function(message,from) {console.log(arguments);}
    }, true
)

new Plugin(
    function Localstream() {
	//this.useEditor("videoUrl",this.urlEditor);
	//this.register("loadVideo",this.loadVideo);
        this.container = this.requestDiv(0);
        this.input = $("<div>").css({padding:"1em 0",fontSize:"1.8em",lineHeight:"1em",
                                     textAlign:"center",borderRadius:4})
            .text("Drag a video here to play and share...").appendTo(this.container);
	progbar = $('<div>').addClass("progress").appendTo(this.container);
	this.progbar = $("<div>").addClass("bar").appendTo(progbar);
        this.processDragElement(this.input);
	this.signalingChannel = new LocalStreamSignalingChannel(this);
    }, {
	urlEditor: function(url) {
	    name = url.split(":")[0];
	    if (/^https?:\/\//.test(name)) { return url; }
	    console.log("urlEditor",url,name);
	    if (typeof localstream.files[name] !== "object") {
		localstream.files[name] = true;
	    }
	    return localstream.files[name].url;
	},
	loadVideo: function(type,args) {
	    name = args[0].split(":")[0];
	    other = args[0].split(":").slice(1).join(":");
	    console.log(name,other);
	    if (isNaN(Number(other))) {
		return true; }
	    if (localstream.files[name] === true) {
		this.startFile(name,Number(other));
	    }
	},
	startVideo: function(file) {
	    url = URL.createObjectURL(file);
	    svp.loadVideo(url,"plugin=localstream:"+hashRandom(url).toString(36));

	    var pc;
	    var configuration = ...;

	    // run start(true) to initiate a call
	    function start(isCaller) {
		pc = new RTCPeerConnection(configuration);

		// send any ice candidates to the other peer
		pc.onicecandidate = function (evt) {
		    signalingChannel.send(JSON.stringify({ "candidate": evt.candidate }));
		};

		// once remote stream arrives, show it in the remote video element
		pc.onaddstream = function (evt) {
		    remoteView.src = URL.createObjectURL(evt.stream);
		};

		// get the local stream, show it in the local video element and send it
		navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
		    selfView.src = URL.createObjectURL(stream);
		    pc.addStream(stream);

		    if (isCaller)
			pc.createOffer(gotDescription);
		    else
			pc.createAnswer(pc.remoteDescription, gotDescription);

		    function gotDescription(desc) {
			pc.setLocalDescription(desc);
			signalingChannel.send(JSON.stringify({ "sdp": desc }));
		    }
		});
	    }

	    signalingChannel.onmessage = function (evt) {
		if (!pc)
		    start(false);

		var signal = JSON.parse(evt.data);
		if (signal.sdp)
		    pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
		else
		    pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
	    };

	},
        processDragElement: function(el) {
            rawinput = el.get(0);
            rawinput.localstream = this;
            rawinput.ondragenter = function(e) {
                if (e.dataTransfer.types.indexOf("Files") > -1) {
                    $(this).css("background-color","#913");
                    return false;
                }
            };
            rawinput.ondragleave = function(e) { $(this).css("background-color","inherit"); }
            rawinput.ondragover = function(e) { return false; }
            rawinput.ondrop = function(e) {
                this.ondragleave();
                files = e.dataTransfer.files;
                if (!files || !files.length || files.length > 1) {
                    alert("Please drag and drop exactly one file!"); return false; }
                if (files[0].type.substring(0,6) != "video/") {
                    alert("This is a video player only!"); return false; }
		this.localstream.startVideo.call(this.localstream,files[0]);
		/*$(this).data("original-text",$(this).text())
		    .html('Loading your video<span class="localstream-loading-ellipses">'+
			  '...</span>');
		localstream.ellipsesTimer();*/
                return false;
            };
        },
	    /*
		} else if (type == "progress") {
		    this.progbar.css({width:(e.data.percentage*100)+"%",opacity:1})
			.text(this.progressTexts[e.data.step])
			.parent().addClass("progress-striped active")
			.removeClass("progress-info progress-danger progress-warning")
			.addClass(this.progressClasses[e.data.step]);
		    if (e.data.percentage == 1) {
			this.progbar.css("opacity",0.5);
			this.progbar.parent().removeClass("progress-striped active");
			if (e.data.step == "download") {
			    svp.player.load(); svp.player.play(); }
		    }
		}
	    */
	progressTexts: {
	    preparation: "Allocating File...",
	    download: "Receiving File...",
	    filecopy: "Copying File..."
	},
	progressClasses: {
	    preparation: "progress-danger",
	    download: "progress-warning",
	    filecopy: "progress-info"
	}
    }
);
