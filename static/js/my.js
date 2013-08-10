/**
   Social Video Player
   
   @author Aaron Olkin

   @module SVP
   @namespace client.core
*/

/**
   The base object for the application.
   @class svp
   @static
*/
var svp = {};
svp.extraColors = {};

function hashRandom(str) {
    if (str.length == 0) return 0;
    var hash = Math.round(Math.random()*100000);
    for (i = 0; i < str.length; i++) {
	char = str.charCodeAt(i);
	hash = ((hash<<5)-hash)+char;
	hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

function randomColor() { return "#"+('00000'+(Math.random()*(1<<24)|0).toString(16)).slice(-6); }

function complementHex(hex_color) {
    c = hex_color.replace(/^#/,'')
    sum = parseInt(c[0]+c[1], 16)
    sum += parseInt(c[2]+c[3], 16)
    sum += parseInt(c[4]+c[5], 16)
    return (sum < 200)?"#FFFFFF":"#000000";
}

function hhmmss(seconds,frac) {
    return moment.unix(seconds-68400).format("HH:mm:ss"+(frac?".S":""))
}

svp.loadUrls = function(query, process) {
    jsonurl = "url-json/"+($("#url-file").val()?$("#url-file").val():"urls");
    if (jsonurl.indexOf(".json",jsonurl.length-5) === -1) { jsonurl += ".json"; }
    $.ajax({
	url: jsonurl,
	cache: false,
	dataType: "json"
    }).done(function(data,status,xhr){
	process(data);
    }).fail(function(xhr,error){
	console.log("Typeahead XHR Error:",error);
    });
    $.ajax({
	url: jsonurl.slice(0,-5)+".info.json",
	cache: false,
	dataType: "json"
    }).done(function(data,status,xhr){
	svp.videoInfo = data;
    }).fail(function(xhr,error){
	console.log("Typeahead XHR Error:",error);
    });
}

/**
   Called to display the information associated with a given video in the
   "Load a New Video" dialog box.
   @method updateVideoInfo
   @param {String} item The URL to a video
   @return {String} item
*/
function updateVideoInfo(item){
    if (!svp.videoInfo) { return item; }
    obj = svp.videoInfo[item];
    if (!obj) {
	$("#video-info").html("Sorry, no info found for this url.");
	return item; }
    info = '<div class="info-item info-title text-success"><h4>'+
	(obj.title?obj.title:"No Title")+
	'</h4></div><div class="info-item info-description">'+
	(obj.desc?obj.desc:"No Description")+'</div>'+
	'<div class="info-item info-website pull-right"><a'+
	(obj.link?' href="'+obj.link+'" target="_blank"':'')+'>'+
	(obj.link?obj.link:"No Website")+'</a></div>'+
	'<div class="info-item info-length text-info">'+
	(obj.length?hhmmss(obj.length):"Unknown")+'</div>';
    $("#video-info").html(info);
    plugins.event(null,arguments);
    return item;
}
$("#video-url").typeahead({
    source: svp.loadUrls,
    minLength: 0,
    updater: updateVideoInfo
}).on("keyup change",function(){ updateVideoInfo($(this).val()); });

$(function(){

    /**
       Called when the volume is adjusted using the slider
       (which should be the only way for the volume to change).
       *For Plugin use, see {{#crossLink "svp/syncVolume:event"}}here{{/crossLink}}.*
       @method syncVolume
       @param {Event} e The event object
       @param {Object} ui The jQueryUI second callback argument
    */
    /**
       Fired when the volume is adjusted.
       @event syncVolume
       @param {Number} volume The new volume as a decimal
    */
    function syncVolume(e,ui) {
	svp.player.volume = ui.value/100;
	plugins.event(arguments.callee,[svp.player.volume]);
    }
    $("#volume").slider({
	orientation: "vertical",
	range: "min",
	value: 100,
	slide: syncVolume, change: syncVolume
    }).hide().parent().hover(function(){
	$("#volume").show()
    },function(){
	$("#volume").hide();
    }).click(function(){
	el = $("#volume");
	val = el.slider("value");
	if (val !== 0) {
	    el.data("old-volume",val);
	    el.slider("value",0);
	} else {
	    val = el.data("old-volume");
	    el.slider("value",val?val:100);
	}
    });

    try {
	$("#timeline").data("bumped",false);
    } catch (err) { }
    /**
       Called on video timeupdate, it takes care of updating all the various counters,
       timelines, etc, as well as broadcasting the update.
       @method syncPos
       @param {Event} e The event object
    */
    function syncPos(e) {
	svp.watchers[0].pos = Math.round(svp.player.currentTime*10)/10;
	$(".watcher:first-of-type .time").text(hhmmss(svp.watchers[0].pos,true));
	$("#global-pos").css("width",(svp.player.currentTime/svp.player.duration*100)+"%");
	texts = [hhmmss(svp.player.currentTime),
		 "-"+hhmmss(svp.player.duration-svp.player.currentTime)];
	$(".span1.time").each(function(index,el){
	    $(el).text(texts[index]);
	});
	time = svp.player.currentTime;
	origmin = min = $("#timeline").slider("option","min");
	origmax = max = $("#timeline").slider("option","max");
	$("#slider-view").css("width",(max-min)/svp.player.duration*100+"%")
	    .css("left",min/svp.player.duration*100+"%");
	chgsize = (max-min)-10;
	while (time+3>max) {
	    $("#timeline").slider("option",{
		min: min+chgsize, max: max+chgsize
	    });
	    min += chgsize; max += chgsize;
	}
	while (time-3<min) {
	    $("#timeline").slider("option",{
		min: min-chgsize, max: max-chgsize
	    });
	    min -= chgsize; max -= chgsize;
	}
	if (min<0) { $("#timeline").slider("option",{min:0,max:max-min}); }
	if (max>svp.player.duration) {
	    $("#timeline").slider("option", {min:svp.player.duration-(max-min),
					     max:svp.player.duration}); }
	if ($("#timeline").slider("option","min") !== origmin ||
	    $("#timeline").slider("option","max") !== origmax) {
	    $("#timeline").data("bumped",true); }
	svp.ws.broadcast({type:"timeupdate", pos:svp.watchers[0].pos, id:svp.video.id});
	syncAllPos();
	plugins.event(null,arguments);
    }

    function syncAllPos() {
	pos = [];
	for (i in svp.watchers) {
	    if (i !== "length") {
		pos.push(svp.watchers[i].pos);
		$($(".watcher").get(i)).children(".time").text(hhmmss(svp.watchers[i].pos,true));
	    }
	}
	$("#timeline").slider("option","values",pos);
    }
    
    function doubleRate(el) {
	if (Math.abs(svp.player.playbackRate) < 8) {
	    svp.player.playbackRate *= 2;
	    $(el).html("&times;"+Math.abs(svp.player.playbackRate));
	    $(".playpause i").addClass("icon-play");
	    $(".playpause i").removeClass("icon-pause");
	} else {
	    svp.player.playbackRate = 1;
	    $(el).html($(el).data("original-html"));
	    $(".playpause i").removeClass("icon-play");
	    $(".playpause i").addClass("icon-pause");
	}
    }

    svp.reverseSeeking = false;
    function reverseSeek() {
	if (svp.player.playbackRate > 0) {
	    svp.reverseSeeking = false;
	    return false;
	}
	svp.reverseSeeking = true;
	svp.player.currentTime += svp.player.playbackRate/2-0.5
	setTimeout(reverseSeek,500);
    }

    function resetTransport() {
	$("#fast-forward").html($("#fast-forward").data("original-html"));
	$("#fast-back").html($("#fast-back").data("original-html"));
    }

    /**
       Handles skip/ff controls.
       @method transportClick
       @param {Event} e The Event object
     */
    $("#transport .btn[id]").click(function transportClick(e){
	resetTransport();
	resetSync();
	if (this.id.indexOf("fast") >= 0) {
	    svp.player.play();
	    if (!$(this).data("original-html")) {
		$(this).data("original-html",$(this).html()); }
	    if (this.id.indexOf("forward") >= 0) {
		if (svp.player.playbackRate < 0) {
		    svp.player.playbackRate = 1; }
		doubleRate(this);
	    } else {
		if (svp.player.playbackRate > 0) {
		    svp.player.playbackRate = -1; }
		doubleRate(this);
		reverseSeek();
	    }
	} else if (this.id.indexOf("jump") >= 0) {
	    svp.player.playbackRate = 1;
	    svp.player.currentTime += ((this.id.indexOf("back")>=0)?-300:300);
	    broadcastJump();
	}
	plugins.event(null,arguments);
    });

    /**
       Broadcasts information about a jump.
       @method broadcastJump
       @param {String} from The username from which the jump originated
     */
    function broadcastJump(from) {
	svp.ws.broadcast({
	    id: svp.video.id,
	    type: "jump",
	    pos: svp.player.currentTime,
	    from: from
	});
	plugins.event(null,arguments);
    }

    /**
       Broadcasts information about a state (playing/paused) change.
       @method broadcastStateChange
     */
    function broadcastStateChange() {
	svp.ws.broadcast({
	    id: svp.video.id,
	    type: "statechange",
	    paused: svp.player.paused
	});
	plugins.event(null,arguments);
    }

    svp.tlsize = 100;
    function rebuildTimeline() {
	min = max = null;
	tlsize = svp.tlsize;
	try {
	    min = svp.player.currentTime-10;
	    max = svp.player.currentTime+(tlsize-10);
	} catch (err) { }
	try {
	    min = $("#timeline").slider("option","min");
	    max = $("#timeline").slider("option","max");
	} catch (err) { }
	if (max-min !== tlsize) {
	    max = min+tlsize; }
	try {
	    $("#timeline").slider("destroy");
	} catch (err) { }
	values = [];
	for (i in svp.watchers) {
	    if (i !== "length") {
		values.push(svp.watchers[i].pos); } }
	$("#timeline").slider({
	    animate: true,
	    min: min?min:-10, max: max?max:tlsize-10,
	    range: "min",
	    step: 0.1,
	    values: values,
	    slide: function(e,ui) {
		if (!$("#timeline").data("bumped") && $(ui.handle).is(":first-of-type")) {
		    $(ui.handle).next("div").remove()
		    resetSync();
		    if (ui.value < 0) { e.preventDefault(); return false; }
		    svp.player.currentTime = ui.value;
		    plugins.event("timelineSlide",[ui.value]);
		} else {
		    e.preventDefault(); }
	    },
	    stop: function(e,ui) {
		$("#timeline").data("bumped",false);
		broadcastJump();
	    },
	    start: function(e,ui) {
		$("#timeline").data("bumped",false);
	    }
	}).hover(function(){
	    $("#timeline a:not(:first-of-type)").css("zIndex",1);
	},function(){
	    $("#timeline a:not(:first-of-type)").css("zIndex",2);
	});
	$("#timeline").children("a").each(function(index,el){
	    node = $(el).attr("title",svp.watchers[index].name).attr("data-toggle","tooltip")
		.tooltip().css("background-color",svp.watchers[index].color)
		.css("background-image","none").css("opacity",(svp.watchers[index].hidden?
							       0.2:1));
	});
	$("#watchers h4 .badge-info").text(svp.watchers.length);
    }
    svp.rebuildTimeline = rebuildTimeline;

    /**
       Called to reset who is being synced to when the local user takes an action.
       @method resetSync
     */
    function resetSync() {
	$("button.sync.active").each(function(index,el){
	    name = $(el).parent().parent().prev().prev().text();
	    svp.ws.message({
		id: svp.video.id,
		type: "sync",
		sync: false,
	    },name);
	    $(el).effect("highlight").btn("toggle");
	});
	svp.video.syncTo = 0;
	plugins.event(null,arguments);
    }

    /**
       Adds all of the DOM elements and configuration for a new "watcher".
       @method addWatcher
       @param {Object} watcher The "watcher" object to add
     */
    function addWatcher(watcher) {
	index = svp.watcherIndices[watcher.name] = svp.watchers.push(watcher)-1;
	colorstyles = watcher.color?' style="background-color:'+watcher.color+';'+
	    'color:'+complementHex(watcher.color.substr(1))+'"':"";
	$('<li class="watcher you row-fluid"'+colorstyles+'>'+
          '<div class="span4 name">'+watcher.name+'</div>'+
          '<div class="span4 time">Loading...</div>'+
	  '<div class="span4 actions"><div class="btn-group pull-right">'+
	  '<button class="btn sync">'+(watcher.name=="You"?"De-sync":"Sync")+'</button>'+
          '<button class="btn dropdown-toggle" data-toggle="dropdown">'+
	  '<span class="caret"></span></button><ul class="dropdown-menu">'+
	  '<li><a href="#" class="watcher-hide">Darken</a></li>'+
          '</ul></div></div></li>').appendTo("#watchers");
	$("a.watcher-hide").eq(index).click(function(e) {
	    e.preventDefault();
	    index = $(this).data("watcher-index");
	    $(this).parent().toggleClass("active")
	    $(".watcher").eq(index).toggleClass("hidden-watcher");
	    svp.watchers[index].hidden = !svp.watchers[index].hidden;
	    svp.rebuildTimeline();
	}).data("watcher-index",index);
	$("button.sync").eq(index).btn().click(function(e) {
	    resetSync();
	    $(this).btn('toggle');
	    index = $(this).data("watcher-index");
	    svp.video.syncTo = index;
	    if (index === 0) {
		$(this).btn('toggle');
		return false; }
	    svp.player.currentTime = svp.watchers[index].pos;
	    svp.ws.message({
		id: svp.video.id,
		type: "sync",
		sync: true
	    },svp.watchers[index].name);
	}).data("watcher-index",index);
	rebuildTimeline()
	plugins.event(null,arguments);
    }
    svp.addWatcher = addWatcher;
    
    /**
       Loads a new video into the DOM and resets objects.
       @method loadVideo
       @param {String} url The video URL
       @param {String} id A semi-random ID for identifying this viewing session
       @return {Mixed} true (upon successful completion)
     */
    function loadVideo(url,id) {
	/**
	   Allows editing of the video url before loading it into the video element.
	   @event videoUrl
	   @param {String} url The original URL
	*/
	video = {};
	video.url = url;
	video.id = id?id:hashRandom(video.url).toString(36);
	video.chats = [];
	if (video.id == "0") {
	    return false; }
	try {
	    $("#volume").show()
		.position({"my":"center bottom","at":"center","of":$("#volume").prev()}).hide();
	} catch (err) {}
	svp.video = video;
	svp.watchers = [];
	svp.watcherIndices = {};
	$("#link").val(location.origin+"/#join:"+svp.video.id);
	$(".watcher").remove()
	$("#player").attr("src",plugins.editor("videoUrl",svp.video.url)).attr("poster","");
	svp.player.load();
	$("#current-url a").attr("href",svp.video.url).text(svp.video.url).click(
	    function(e){ e.preventDefault(); });
	svp.addWatcher({
	    name: "You",
	    pos: 0,
	    color: null
	});
	plugins.event(null,arguments);
	return true;
    }
    svp.loadVideo = loadVideo;
    $("#load-video-modal .modal-footer .btn-info").click(function(e) {
	if (!svp.loadVideo($("#video-url").val())) {
	    e.preventDefault();
	} else { location.assign("#"); }
    });

    blackbg = "body, .well, .progress, #chat-frame, #chat-entry, #current-url a";
    svp.resetPlayState = function resetPlayState() {
	$(".playpause i").removeClass("icon-pause");
	$(".playpause i").addClass("icon-play");
	$("#info .progress-default").removeClass("progress-striped active");
    }
    /**
       Turns the lights on!
       @method lightsOn
     */
    svp.lightsOn = function lightsOn() {
	$(blackbg).removeClass("blackbg muted",1000).removeClass("blackbg muted");
	$(".btn").removeClass("btn-inverse",500);
	$(".btn i").delay(300).removeClass("icon-white",1);
	$("#lights-text").text("Out");
	svp.lightsAreOn = true;
	plugins.event(null,arguments);
    }
    /**
       Turns the lights out!
       @method lightsOff
     */
    svp.lightsOff = function lightsOff() {
	$(blackbg).stop(true,true).addClass("blackbg muted");
	$(".btn").stop(true,true).addClass("btn-inverse");
	$(".btn i").stop(true,true).addClass("icon-white");
	$("#lights-text").text("On");
	svp.lightsAreOn = false;
	plugins.event(null,arguments);
    }
    svp.lightsAreOn = true;

    /**
       Called when a play/pause event is needed, for whatever reason.
       @method stateChange
       @param {String} [from] The username of the person who initiated the state change
     */
    function stateChange(from) {
	resetTransport();
	if (!from) {
	    resetSync(); }
	if (svp.player.playbackRate !== 1) {
	    svp.player.playbackRate = 1;
	    $(".playpause i").toggleClass("icon-pause icon-play");
	    broadcastJump();
	    return false; }
	svp.resetPlayState();
	if (svp.player.readyState === 0) { svp.player.load(); console.log("Loading..."); }
	if (svp.player.paused) {
	    svp.lightsOff();
	    svp.player.play();
	    $("#info .progress-default").addClass("progress-striped active");
	    $(".playpause i").toggleClass("icon-pause icon-play");
	} else {
	    svp.player.pause();
	}
	broadcastStateChange(from);
	plugins.event(null,arguments);
    }

    /**
       Called when the player or a playpause button is clicked.
       @method playPause
       @param {Event} e The click event
    */
    $(".playpause, #player").click(function playPause(e){
	stateChange();
	plugins.event(null,arguments);
    });
    $("#lights-control").click(function(){
	(svp.lightsAreOn?svp.lightsOff:svp.lightsOn)();
    });

    svp.player = $("#player").get(0);
    svp.player.addEventListener("timeupdate",syncPos);
    svp.player.addEventListener("ended",svp.resetPlayState);

    /**
       Called to process and display a chat message.

       If the player is not aware of the specified "from" user, it will create a new
       random color to use. This color will persist if that username reoccurs.
       @method receiveChat
       @param {String} from The username of the person who sent the message ("You" if the local user)
       @param {String} message The message he or she sent
       @param [time] The timestamp for the message (if left out the current time is used)
     */
    function receiveChat(from,message,time) {
	if (!message) { return false; }
	message = plugins.filter(message,from,time);
	if (svp.watcherIndices[from]) {
	    colorstyle = 'background-color:'+svp.watchers[svp.watcherIndices[from]].color;
	} else {
	    if (!svp.extraColors[from]) { svp.extraColors[from] = randomColor(); }
	    colorstyle = 'background-color:'+svp.extraColors[from];
	}
	timestamp = time?time:new Date().getTime()/1000;
	svp.video.chats.push({from:from,message:message,time:timestamp});
	$("#chat-messages").append('<div class="media">'+
				   '<a class="pull-left chat-icon" style="'+colorstyle+'"></a>'+
				   '<div class="media-body">'+
				   '<div class="pull-right chat-time text-info" data-livestamp="'+
				   timestamp+'"></div>'+
				   '<h5 class="media-heading">'+from+'</h5>'+
				   '<div class="chat-message">'+message+'</div>'+
				   '</div></div>');
	$("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
	plugins.event(null,arguments);
    }
    svp.receiveChat = receiveChat;
    $("#chat-input").keyup(function(e){
	if (e.which == 13) {
	    svp.ws.broadcast({
		type: "chat",
		id: svp.video.id,
		message: $("#chat-input").val()
	    });
	    receiveChat("You",$("#chat-input").val());
	    $("#chat-input").val('');
	}
    });

    /**
       The WSChat instance responsible for transmitting data between clients.
       @property ws
       @type WSChat
       @default WSChat();
     */
    svp.ws = WSChat();
    /**
       Handles WSChat errors.
       @method wsError
       @param {Number} code The WSChat error code
       @param {String} message A friendly error message
    */
    svp.ws.onerror = function wsError(code,message) {
	console.log(code,message);
	if (code == 305) {
	    location.assign("#error:nameexists");
	    location.reload();
	}
	plugins.event(null,arguments);
    };
    /**
       Handles WSChat "messages".
       @method wsMessage
       @param {Object} data The message data 
       @param {String} from The user who sent the message
       @param {Event} e The raw event
    */
    /**
       Receives private WebSocket plugin messages.
       @event plugin{type}
       @param {Mixed} data Depends on the plugin that sent the message
    */
    svp.ws.onmessage = function wsMessage(data,from,e) {
	if (data.type == "plugin") {
	    plugins.event("plugin"+data.data.type,data.data);
	} else if (data.type == "info") {
	    processChats = false;
	    if (!svp.video || svp.video.url !== data.url) {
		svp.player.addEventListener("canplay",function() {
		    console.log("Canplay");
		    svp.player.currentTime = data.mypos; });
		svp.loadVideo(data.url,svp.joinid);
		if (data.paused !== svp.player.paused) { stateChange(); }
		processChats = true;
	    }
	    if (!(name in svp.watcherIndices)) {
		addWatcher({
		    name: from,
		    pos: data.mypos,
		    color: randomColor()
		});
	    }
	    if (processChats) {
		for (i in data.chats) {
		    if (i !== "length") {
			chatfrom = data.chats[i].from;
			if (chatfrom == "You") { chatfrom = from; }
			if (chatfrom == sessionStorage.svpUsername) { chatfrom = "You"; }
			try {
			    receiveChat(chatfrom,data.chats[i].message,data.chats[i].time);
			} catch (err) { }
		    }
		}
	    }
	} else if (data.type == "sync") {
	    console.log(from);
	    $(".watcher").eq(svp.watcherIndices[from]).effect("highlight")
		.attr("title",data.sync?"Synced to you":"No longer synced to you");
	}
	plugins.event(null,arguments);
    };
    /**
       Handles WSChat "broadcasts".
       @method wsBroadcast
       @param {Object} data The message data 
       @param {String} from The user who sent the message
       @param {Event} e The raw event
    */
    /**
       Receives special WSChat plugin broadcasts that are independent of the current video ID.
       @event pluginGlobal{type}
       @param {Mixed} data Depends on the plugin that sent the message
    */
    /**
       Receives WSChat plugin broadcast messages.
       @event pluginBroadcast{type}
       @param {Mixed} data Depends on the plugin that sent the message
    */
    svp.ws.onbroadcast = function wsBroadcast(data,from,e) {
	if (data.type == "pluginGlobal") {
	    plugins.event("pluginGlobal"+data.data.type,data.data); }
	if (data.id != ((svp.video&&svp.video.id)?svp.video.id:svp.joinid)) { return false; }
	if (data.type == "plugin") {
	    plugins.event("pluginBroadcast"+data.data.type,data.data);
	} else if (data.type == "join") {
	    svp.ws.message({
		type: "info",
		url: svp.video.url,
		id: svp.video.id,
		chats: svp.video.chats,
		paused: svp.player.paused,
		mypos: svp.watchers[0].pos
	    },from);
	    if (!(from in svp.watcherIndices)) {
		svp.addWatcher({
		    name: from,
		    pos: 0,
		    color: randomColor()
		});
	    }
	} else if (data.type == "timeupdate") {
	    try {
		svp.watchers[svp.watcherIndices[from]].pos = data.pos;
		syncAllPos();
	    } catch (err) { }
	} else if (data.type == "jump") {
	    try {
		if (svp.watcherIndices[from] === svp.video.syncTo) {
		    if (!data.from || svp.watcherIndices[data.from] !== svp.video.syncTo) {
			svp.player.currentTime = data.pos;
			broadcastJump(from);
		    }
		}
	    } catch (err) { }
	} else if (data.type == "statechange") {
	    try {
		if (svp.watcherIndices[from] === svp.video.syncTo) {
		    if (data.paused !== svp.player.paused) { stateChange(from); }
		}
	    } catch (err) { }
	} else if (data.type == "chat") {
	    receiveChat(from,data.message);
	} else if (data.type == "loadPlugin") {
	    console.log(data.plugin);
	    plugins.load(data.plugin,function(){},function(){console.log(arguments);});
	}
	plugins.event(null,arguments);
    };
    /**
       Handles WSChat quits (when another client disconnects).
       @method wsQuit
       @param {String} who The user who disconnected
       @param {Event} e The raw event
    */
    svp.ws.onquit = function wsQuit(who,e) {
	try {
	    index = svp.watcherIndices[who];
	} catch (err) { return false; }
	if (!index) { return false; }
	console.log(index,svp.watchers[index],who);
	if (index === svp.video.syncTo) {
	    resetSync();
	} else if (index < svp.video.syncTo) {
	    svp.video.syncTo -= 1; }
	svp.watchers.splice(index,1);
	for (i in svp.watcherIndices) {
	    if (svp.watcherIndices[i] > index) {
		svp.watcherIndices[i] -= 1; }
	}
	delete svp.watcherIndices[who];
	$(".watcher").eq(index).remove();
	rebuildTimeline();
	plugins.event(null,arguments);
    }    

    function watcherExists(name) {
	for (i in svp.watchers) {
	    if (i !== "length") {
		if (svp.watchers[i].name == name) {
		    return true;
		}
	    }
	}
    }

    /**
       Called on initialization of the WSChat client.
       @event init
       @param {String} name The username that the local client will save and use
    */
    /**
       Initializes the WSChat client.
       @method initializeClient
       @param {String} name The username that the local client will save and use
    */
    function init(name) {
	localStorage.svpUsername = name
	$("#load-video-modal").modal('show');
	if (location.hash.substr(1,5) == "join:") {
	    $("#load-video-modal").modal('hide');
	    svp.ws.onconnected = function(e) {
		svp.joinid = location.hash.substr(6);
		if (svp.joinid.substr(0,6) == "plugin") {
		    parts = svp.joinid.substr(7).split(":");
		    plugins.load("plugins/"+parts[0],function(){
			svp.ws.broadcast({type:"join",id:svp.joinid});
		    },function(){console.log(arguments[2].toString());});
		} else {
		    svp.ws.broadcast({type:"join",id:svp.joinid});
		}
	    }
	}
	svp.ws.init("ws://"+location.host+"/wschat",name);
	plugins.event(null,arguments);
    }
    svp.initializeClient = init;
    $("#set-name-modal").modal({
	backdrop: "static",
	keyboard: false,
	show: true
    }).modal('show');
    $("#load-plugin-modal").modal({
	show: false
    }).on("show",function(){
	$.getJSON("/pluginlist",function(data,status) {
	    for (i in data) {
		if (!document.getElementById(i)) {
		    $("<button>").appendTo("#load-plugin-modal .modal-body")
			.addClass("btn").text('Load "'+i+'"').prop("id",i)
			.data("plugin",data[i]).data("pname",i).click(function(e){
			    $(this).prop("disabled","disabled").text("Loading...");
			    plugins.load($(this).data("plugin"),$.proxy(function(){
				$(this).prop("disabled","disabled")
				    .text('Loaded "'+$(this).data("pname")+'"');
			    },this),$.proxy(function(xhr,err,e){
				console.log("Plugin loading error:",err,e);
				$(this).text('Load "'+$(this).data("pname")+'"')
				    .prop("disabled","");
				$("<div>").appendTo($(this).parent()).append(
				    '<button class="close" data-dismiss="alert">&times;</button>'
					+'<strong>Failed to load plugin!</strong>')
				    .css({position:"absolute",bottom:0})
				    .addClass("alert alert-error").delay(2000).fadeOut(500);
			    },this));
			});
		}
	    }
	});
    });
    
    if (location.hash.substr(1,10) == "error:name") {
	$("#nickname").val(localStorage.svpUsername);
	textel = $("#set-name-modal .alert-error").removeClass("hide").children("span");
	error = location.hash.substr(7);
	if (error == "nameexists") {
	    textel.html("Someone with that username is already connected to the server!<br>Please use a different username.");
	} else {
	    textel.html("A Username error occured! Please try again.");
	}
    } else if (localStorage.svpUsername) {
	$("#set-name-modal").modal('hide');
	init(localStorage.svpUsername);
    }
    $("#set-name-modal .modal-footer .btn").click(function(){
	name = $("#nickname").val();
	if (name) {
	    $("#set-name-modal").modal("hide");
	    init(name);
	}
    })

    /**
       Plugin functionality, as amended by the SVP core. To view the plugin 
       constructor documentation, please see
       {{#crossLink "client.api.Plugin"}}here{{/crossLink}}.
       @class Plugin
       @extends client.api.Plugin
    */

    /**
       Creates a new element for a plugin to use.
       @method requestDiv
       @param {Number} size=0 Pass a zero for a smaller-width container or a one
       for a larger container. Other sizes do not exist at this time.
       @return {jQuery Array} a jQuery array containing a single div
    */
    Plugin.prototype.requestDiv = function(size) {
	if (size === undefined) { size = 0; }
	if (size == 0) {
	    return $("<div>").addClass("well well-small")
		.appendTo("body>.container-fluid>.row-fluid>.span4");
	} else if (size == 1) {
	    return $("<div>").addClass("well").appendTo("body>.container-fluid>div>.span8");
	} else {
	    return $();
	}
    }
    /**
       Registers a string filter for chat messages using a regex.
       @method useFilter
       @param {String} regex This filter will only be applied if the regex matches
       @param {Function} callback The method to register. It will be called in the context of the plugin.
       @param {Boolean} [notOnInit] If `true`, this filter will not be applied to existing messages
       @return {Number} The registration ID, can be used to unregister the filter later. (Note: unregistering is not implemented yet.)
    */
    Plugin.prototype.useFilter = function(regex,callback,notOnInit) {
	if (!notOnInit && svp.video && svp.video.chats) {
	    for (i in svp.video.chats) {
		message = svp.video.chats[i].message;
		if (typeof regex == "string") {
		    re = RegExp(regex);
		} else { re = regex; }
		if (re.test(message)) {
		    callback.apply(this,[message]);
		}
	    }
	}
	this._register("filter",regex,callback);
    }

    Plugin.prototype._register("handler","loadPlugin",function(type,args) {
	url = args[0];
	svp.ws.broadcast({
	    type: "loadPlugin",
	    plugin: url
	});
    });

    plugins.init(svp);

});
