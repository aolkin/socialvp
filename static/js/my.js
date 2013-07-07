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
	process(data); });
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
	    $(el).attr("title",svp.watchers[index].name).attr("data-toggle","tooltip").tooltip()
		.css("background-color",svp.watchers[index].color).css("background-image","none");
	});
    }
    svp.rebuildTimeline = rebuildTimeline;

    function addWatcher(watcher) {
	svp.watchers.push(watcher);
	colorstyles = watcher.color?' style="background-color:'+watcher.color+';'+
	    'color:'+complementHex(watcher.color.substr(1))+'"':"";
	$('<li class="watcher you row-fluid"'+colorstyles+'>'+
          '<div class="span4 name">'+watcher.name+'</div>'+
          '<div class="span4 time">Loading...</div>'+
	  '<div class="span4 actions btn-group">'+
          '<a class="btn btn-small dropdown-toggle pull-right" data-toggle="dropdown" href="#">'+
          'Actions <span class="caret"></span></a>'+
          '<ul class="dropdown-menu">'+
          '<!--<li><a href="#'+watcher.name+':kick">Kick</a></li>-->'+
          '</ul></div></li>').appendTo("#watchers");
	rebuildTimeline()
	$("#watchers h3 .badge-info").text(svp.watchers.length);
    }
    svp.addWatcher = addWatcher;
    
    $("#load-video-modal .modal-footer .btn-info").click(function(e) {
	video = {};
	video.url = $("#video-url").val();
	video.id = hashRandom(video.url).toString(36);
	if (video.id == "0") {
	    e.preventDefault();
	    return false; }
	try {
	    $(".container-fluid.hide").show();
	    $("#volume").show()
		.position({"my":"center bottom","at":"center","of":$("#volume").prev()}).hide();
	} catch (err) {}
	svp.video = video;
	svp.watchers = [];
	$("#link").val(location.origin+"/#join:"+svp.video.id);
	$(".watcher").remove()
	$("#player").attr("src",svp.video.url);
	$("#current-url a").attr("href",svp.video.url).text(svp.video.url).click(
	    function(e){ e.preventDefault(); });
	svp.addWatcher({
	    name: "You",
	    pos: 0,
	    color: null
	});
    });

    blackbg = "body, .well, .progress";
    svp.resetPlayState = function() {
	$("#playpause i").toggleClass("icon-play icon-pause");
	$("#info .progress").removeClass("progress-striped active");
	/* Turn on the lights... */
	$(blackbg).removeClass("blackbg");
	$(".btn").removeClass("btn-inverse");
	$(".btn i").removeClass("icon-white");
	/* --- */
    }
    svp.lightsOff = function() {
	/* Turn out the lights... */
	$(blackbg).addClass("blackbg");
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
	    $("#playpause i").addClass("icon-pause");
	} else {
	    svp.player.pause();
	    $("#playpause i").addClass("icon-play");
	}
    });

    svp.player = $("#player").get(0);
    svp.player.addEventListener("timeupdate",syncPos);
    svp.player.addEventListener("ended",svp.resetPlayState());

    function init(name) {
	sessionStorage.svpUsername = name
	    $("#load-video-modal").modal('show');
	if (location.hash.substr(1,5) == "join:") {
	    $("#load-video-modal").modal('hide');
	} else {
	    
	}
    }
    $("#get-link-modal").modal("show").modal("hide");
    $("#set-name-modal").modal({
	backdrop: "static",
	keyboard: false,
	show: true
    }).modal('show');
    
    if (sessionStorage.svpUsername) {
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
