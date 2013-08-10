localvideo = {};
// Filesystem Size:  kb   mb   gb  12 (12GB)
localvideo.fssize = 1024*1024*1024*12;
localvideo.storageInfo = navigator.webkitPersistentStorage || navigator.persistentStorage;

localvideo.files = {};

localvideo.ellipsesTimer = function() {
    $(".localvideo-loading-ellipses").each(function(index,el){
	current = localvideo.ellipses.indexOf($(el).text())+1;
	if (current > 3) { current = 0; }
	$(el).text(localvideo.ellipses[current]);
    });
    setTimeout(localvideo.ellipsesTimer,700);
};
localvideo.ellipses = ['', '.', '..', '...'];

new Plugin(
    function LocalVideo() {
	this.useEditor("videoUrl",this.urlEditor);
	this.register("loadVideo",this.loadVideo);
        localvideo.storageInfo.queryUsageAndQuota($.proxy(function(used,quota) {
            if (quota < localvideo.fssize) {
                $("body").append('<div id="localvideo-quota-request-modal" class="modal">'+
                                 '<div class="modal-header"><h3>File Storage Request</h3></div>'+
                                 '<div class="modal-body" style="min-height: 300px;">'+
				 'Chrome should ask whether you want to allow this site to '+
				 'store data on your computer. In order for WebTorrent to work, '+
				 'it needs to be able to store the files it is transmitting and '+
				 'receiving, so please click "OK" above.</div></div>');
		$("#localvideo-quota-request-modal").effect("highlight");
                localvideo.storageInfo.requestQuota(
		    localvideo.fssize,$.proxy(function(fssize){
                        console.log(fssize,"of",localvideo.fssize);
			if (fssize < localvideo.fssize) {
			    alert("You did not grant enough storage space. LocalVideo will "+
				  "not work properly until you do!"); }
			$("#localvideo-quota-request-modal").remove();
                        this.init();
                    },this));
            } else {
                this.init();
            }
        },this));
    }, {
        init: function() {
	    /*f = window.requestFileSystem || window.webkitRequestFileSystem;
	    f(PERSISTENT,localvideo.fssize,function(fs){localvideo.fs=fs;},
	      function(){console.log("FS Request error:",arguments);});*/
            this.container = this.requestDiv(0);
            this.input = $("<div>").css({padding:"1em 0",fontSize:"1.8em",lineHeight:"1em",
                                         textAlign:"center",borderRadius:4})
                .text("Drag a video here to play and share...").appendTo(this.container);
	    progbar = $('<div>').addClass("progress").appendTo(this.container);
	    this.progbar = $("<div>").addClass("bar").appendTo(progbar);
            this.processDragElement(this.input);
            this.loadWorker();
        },
	urlEditor: function(url) {
	    name = url.split(":")[0];
	    if (/https?/.test(name)) { return url; }
	    console.log("urlEditor",url,name);
	    if (typeof localvideo.files[name] !== "object") {
		localvideo.files[name] = true;
	    }
	    return localvideo.files[name].url;
	},
	loadVideo: function(type,args) {
	    name = args[0].split(":")[0];
	    other = args[0].split(":").slice(1).join(":");
	    console.log(name,other);
	    if (isNaN(Number(other))) {
		return true; }
	    if (localvideo.files[name] === true) {
		this.startFile(name,Number(other));
	    }
	},
        processDragElement: function(el) {
            rawinput = el.get(0);
            rawinput.localvideo = this;
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
                this.localvideo.client.postMessage({action:"file",file:files[0]});
		$(this).data("original-text",$(this).text())
		    .html('Loading your video into your WebTorrent client<span '+
			  'class="localvideo-loading-ellipses">...</span>');
		localvideo.ellipsesTimer();
                return false;
            }
        },
        loadWorker: function() {
            this.client = new Worker("plugins/webtorrent.worker.js?_="+hashRandom("worker.js")+
                                     "#"+encodeURIComponent(svp.ws.name));
            this.client.onmessage = $.proxy(this.workerMessage,this);
        },
        startFile: function(name,size) {
            this.client.postMessage({action:"start",size:size,name:name});
        },
        workerMessage: function(e) {
	    if (!e.data) { console.log("Falsy worker message:",e); return false; }
            if (e.data == "killme") {
                this.client.terminate(); 
                this.loadWorker();
            } else if (e.data.type) {
		type = e.data.type;
		if (type == "filecopied" || type == "fileinfo") {
		    file = localvideo.files[e.data.name] = {
			name: e.data.name,
			size: e.data.size,
			url: e.data.bloburl
		    };
		    url = file.name+":"+file.size;
		}
		if (type == "filecopied") {
		    this.input.text(this.input.data("original-text"));
		    svp.loadVideo(url,"plugin=localvideo:"+hashRandom(url).toString(36));
		} else if (type == "fileinfo") {
		    svp.player.src = e.data.bloburl;
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
	    }
            console.log("Worker Message:",e.data);
        },
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
