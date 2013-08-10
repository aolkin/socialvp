new Plugin(
    function URLParser() {
	this.useFilter("\\w+\\.\\w{2,4}",this.filter,true);
    }, {
	filter: function(message) {
	    console.log(message);
	    part = message;
	    message = ""
	    while (part) {
		message += part.substr(0,part.search(/(https?:\/\/|)\w+\.\w{2,4}/mi));
		part = part.substr(part.search(/(https?:\/\/|)\w+\.\w{2,4}/mi));
		parts = part.split(" ");
		part = parts.slice(1).join(" ");
		url = parts[0];
		if (!(/^https?:\/\//.test(url))) { url = "http://"+url; }
		if (/\.(jpe?g|png|gif|bmp|svg)/i.test(url)) {
		    message += $("<div>").append($("<img>").attr("src",url)).html();
		} else {
		    message += $("<div>").append($("<a>").text(url).attr("href",url)
						 .attr("target","_blank")).html();
		}
	    }
	    return message;
	}
    }
);
