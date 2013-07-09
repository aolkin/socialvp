var svp = {};

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
    $.ajax({
	url: "urls.json",
	cache: false,
	dataType: "json"
    }).done(function(data,status,xhr){
	process(data);
    }).fail(function(xhr,error){
	console.log("Typeahead XHR Error:",error);
    });
}
$("#video-url").typeahead({source:svp.loadUrls});

$(function(){

    function syncVolume(e,ui) {
	svp.player.volume = ui.value/100; }
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

    function syncPos(e) {
	svp.watchers[0].pos = Math.round(svp.player.currentTime*10)/10;
	$(".watcher:first-of-type .time").text(hhmmss(svp.watchers[0].pos,true));
	$("#global-pos").css("width",(svp.player.currentTime/svp.player.duration*100)+"%");
	times = [svp.watchers[0].pos-30,svp.watchers[0].pos+30];
	if (times[0] < 0) { times[0] = 0; }
	if (times[1] > svp.player.duration) { times[1] = svp.player.duration; }
	texts = [hhmmss(svp.player.currentTime),
		 "-"+hhmmss(svp.player.duration-svp.player.currentTime)];
	$(".span1.time").each(function(index,el){
	    $(el).text(texts[index]);
	});
	$("#timeline").slider("option",{ min: times[0], max: times[1] });
	svp.ws.broadcast({type:"timeupdate", pos:svp.watchers[0].pos, id:svp.video.id});
	syncAllPos();
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

    function rebuildTimeline() {
	try {
	    $("#timeline").slider("destroy");
	} catch (err) {}
	values = [];
	for (i in svp.watchers) {
	    if (i !== "length") {
		values.push(svp.watchers[i].pos); } }
	$("#timeline").slider({
	    animate: true,
	    min: svp.watchers[0].pos-15, max: svp.watchers[0].pos+15,
	    range: "min",
	    step: 0.1,
	    values: values,
	    slide: function(e,ui) {
		if ($(ui.handle).is(":first-of-type")) {
		    $(ui.handle).next("div").remove()
		    if (ui.value < 0) { e.preventDefault(); return false; }
		    svp.player.currentTime = ui.value;
		} else {
		    e.preventDefault(); }
	    }
	});
	$("#timeline").children("a").each(function(index,el){
	    node = $(el).attr("title",svp.watchers[index].name).attr("data-toggle","tooltip")
		.tooltip().css("background-color",svp.watchers[index].color)
		.css("background-image","none").css("opacity",(svp.watchers[index].hidden?
							       0.2:1));
	});
    }
    svp.rebuildTimeline = rebuildTimeline;

    function addWatcher(watcher) {
	index = svp.watcherIndices[watcher.name] = svp.watchers.push(watcher)-1;
	colorstyles = watcher.color?' style="background-color:'+watcher.color+';'+
	    'color:'+complementHex(watcher.color.substr(1))+'"':"";
	$('<li class="watcher you row-fluid"'+colorstyles+'>'+
          '<div class="span4 name">'+watcher.name+'</div>'+
          '<div class="span4 time">Loading...</div>'+
	  '<div class="span4 actions">'+
          '<a href="#" class="watcher-hide btn pull-right">Darken</a>'+
          '</div></li>').appendTo("#watchers");
	$("a.watcher-hide").eq(index).click(function(e){
	    e.preventDefault();
	    index = $(this).data("watcher-index");
	    $(this).parent().toggleClass("active")
	    $(".watcher").eq(index).toggleClass("hidden-watcher");
	    svp.watchers[index].hidden = !svp.watchers[index].hidden;
	    svp.rebuildTimeline();
	}).data("watcher-index",index);
	rebuildTimeline()
	$("#watchers h3 .badge-info").text(svp.watchers.length);
    }
    svp.addWatcher = addWatcher;
    
    function loadVideo(url,id) {
	video = {};
	video.url = url;
	video.id = id?id:hashRandom(video.url).toString(36);
	if (video.id == "0") {
	    return false; }
	try {
	    $(".container-fluid.hide").removeClass("hide").show();
	    $("#volume").show()
		.position({"my":"center bottom","at":"center","of":$("#volume").prev()}).hide();
	} catch (err) {}
	svp.video = video;
	svp.watchers = [];
	svp.watcherIndices = {};
	$("#link").val(location.origin+"/#join:"+svp.video.id);
	$(".watcher").remove()
	$("#player").attr("src",svp.video.url);
	svp.player.load();
	$("#current-url a").attr("href",svp.video.url).text(svp.video.url).click(
	    function(e){ e.preventDefault(); });
	svp.addWatcher({
	    name: "You",
	    pos: 0,
	    color: null
	});
	return true;
    }
    svp.loadVideo = loadVideo;
    $("#load-video-modal .modal-footer .btn-info").click(function(e) {
	if (!svp.loadVideo($("#video-url").val())) {
	    e.preventDefault(); }
    });

    blackbg = "body, .well, .progress, #chat-frame, #chat-entry, #current-url a";
    svp.resetPlayState = function() {
	$("#playpause i").removeClass("icon-pause");
	$("#playpause i").addClass("icon-play");
	$("#info .progress").removeClass("progress-striped active");
	/* Turn on the lights... */
	$(blackbg).removeClass("blackbg muted");
	$(".btn").removeClass("btn-inverse");
	$(".btn i").removeClass("icon-white");
	/* --- */
    }
    svp.lightsOff = function() {
	/* Turn out the lights... */
	$(blackbg).addClass("blackbg muted");
	$(".btn").addClass("btn-inverse");
	$(".btn i").addClass("icon-white");
	/* --- */
    }

    $("#playpause, #player").click(function(){
	svp.resetPlayState();
	if (svp.player.paused) {
	    svp.lightsOff();
	    svp.player.play();
	    $("#info .progress").addClass("progress-striped active");
	    $("#playpause i").toggleClass("icon-pause icon-play");
	} else {
	    svp.player.pause();
	}
    });

    svp.player = $("#player").get(0);
    svp.player.addEventListener("timeupdate",syncPos);
    svp.player.addEventListener("ended",svp.resetPlayState);

    function recieveChat(from,message) {
	if (!message) { return false; }
	colorstyle = 'background-color:'+svp.watchers[svp.watcherIndices[from]].color;
	$("#chat-messages").append('<div class="media">'+
				   '<a class="pull-left chat-icon" style="'+colorstyle+'"></a>'+
				   '<div class="media-body">'+
				   '<h5 class="media-heading">'+from+'</h5>'+
				   '<div class="chat-message">'+message+'</div>'+
				   '</div></div>');
	$("#chat-messages").scrollTop($("#chat-messages").prop("scrollHeight"));
    }
    $("#chat-input").keyup(function(e){
	if (e.which == 13) {
	    svp.ws.broadcast({
		type: "chat",
		id: svp.video.id,
		message: $("#chat-input").val()
	    });
	    recieveChat("You",$("#chat-input").val());
	    $("#chat-input").val('');
	}
    });

    svp.ws = WSChat();
    svp.ws.onerror = function(code,message) {
	console.log(code,message);
	if (code == 305) {
	    location.assign("#error:nameexists");
	    location.reload();
	}
    };
    svp.ws.onmessage = function(data,from,e) {
	if (data.type == "info") {
	    if (!svp.video || svp.video.url !== data.url) {
		svp.player.addEventListener("canplay",function() {
		    console.log("Canplay");
		    svp.player.currentTime = data.mypos; });
		svp.loadVideo(data.url,svp.joinid);
		if (!data.paused) {
		    $("#playpause").click(); }
	    }
	    if (!(name in svp.watcherIndices)) {
		addWatcher({
		    name: from,
		    pos: data.mypos,
		    color: randomColor()
		});
	    }
	}
    };
    svp.ws.onbroadcast = function(data,from,e) {
	if (data.id != ((svp.video&&svp.video.id)?svp.video.id:svp.joinid)) { return false; }
	if (data.type == "join") {
	    svp.ws.message({
		type: "info",
		url: svp.video.url,
		id: svp.video.id,
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
	    svp.watchers[svp.watcherIndices[from]].pos = data.pos;
	    syncAllPos();
	} else if (data.type == "chat") {
	    recieveChat(from,data.message);
	}
    };

    function watcherExists(name) {
	for (i in svp.watchers) {
	    if (i !== "length") {
		if (svp.watchers[i].name == name) {
		    return true;
		}
	    }
	}
    }

    function init(name) {
	sessionStorage.svpUsername = name
	$("#load-video-modal").modal('show');
	if (location.hash.substr(1,5) == "join:") {
	    $("#load-video-modal").modal('hide');
	    svp.ws.onconnected = function(e) {
		svp.joinid = location.hash.substr(6);
		svp.ws.broadcast({type:"join",id:svp.joinid}); }
	}
	svp.ws.init("ws://"+location.host+"/wschat",name);
    }
    svp.initializeClient = init;
    $("#get-link-modal").modal("show").modal("hide");
    $("#set-name-modal").modal({
	backdrop: "static",
	keyboard: false,
	show: true
    }).modal('show');
    
    if (location.hash.substr(1,10) == "error:name") {
	$("#nickname").val(sessionStorage.svpUsername);
	textel = $("#set-name-modal .alert-error").removeClass("hide").children("span");
	error = location.hash.substr(7);
	if (error == "nameexists") {
	    textel.html("Someone with that username is already connected to the server!<br>Please use a different username.");
	} else {
	    textel.html("A Username error occured! Please try again.");
	}
    } else if (sessionStorage.svpUsername) {
	$("#set-name-modal").modal('hide');
	init(sessionStorage.svpUsername);
    }
    $("#set-name-modal .modal-footer .btn").click(function(){
	name = $("#nickname").val();
	if (name) {
	    $("#set-name-modal").modal("hide");
	    init(name);
	}
    })

});
