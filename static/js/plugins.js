plugins = [];

plugins.init = function (it) {
    plugins.handlers = {};
};
plugins.event = function(type,args) {
    if (!args) { args = []; }
    if (!type) { type = args.callee; }
    if (typeof type == "function") {
	type = type.name; }
    console.log(type,args);
};

/**
   Allows creation of plugins.
   @class Plugin
   @constructor
*/
Plugin = function (func,proto) {
    for (i in proto) {
	this[i] = proto[i];
    }
    func.prototype = this;
    plugins.push(func);
};
Plugin.prototype = {
    register: function(type,callback){
	plugins.handlers[type] || plugins.handlers[type] = [];
	return plugins.handlers[type].push($.proxy(callback,this));
    }
};
