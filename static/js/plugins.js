/**
   A reusable and generic plugin API.

   @author Aaron Olkin

   @module PluginAPI
*/

/**
   The global object which core code can hook into.
   @class plugins
   @static
*/
plugins = [];
/**
   Set by the core code when all preset plugins have been initialized
   and it is ready. It allows plugins loaded in the future to be
   instantiated immediately.
*/
plugins.loaded = false;

/**
   Sets up additional plugin machinery.
   
   I'm not really sure why this is necessary...
   @method init
   @param {Mixed} it The one and only IT!
   @deprecated
*/
plugins.init = function (it) {
    /**
       Holds arrays of event callbacks.
       @property handlers
       @private
     */
    plugins.handlers = {};
    /**
       Holds arrays of string filters.
       @property filters
       @private
     */
    plugins.filters = {};
};

/**
   Core code should call this to post an event for plugins to catch.
   @method event
   @param {Mixed} type Either a function (whose name will then be used) or a string
   @param {Array} args An array of arguments available to callbacks
   @example 
       plugins.event(null,arguments); // will use the name of the callee from the arguments variable
*/
plugins.event = function(type,args) {
    if (!args) { args = []; }
    if (!type) { type = args.callee; }
    if (typeof type == "function") {
	type = type.name; }
    console.log(type,args);
};
/**
   Core code should call this to allow plugins to filter certain strings.
   @method filter
   @param {String} message The string to filter
   @param {Mixed} [*arguments] Any additional arguments will still be
       passed through, as an array
   @return {String} The (possibly) filtered message
*/
plugins.filter = function(message) {
    for (i in plugins.filters) {
	// Do regex stuff here...
    }
    return message
}

/**
   Mostly a wrapper around a jQuery.getScript call, it provides some URL help.
   @method load
   @param {String} url The URL/name of the plugin to load. If it does not
       end with .plg.js, or at least .js, those suffixes will be added.
   @param {Function} ready A success callback
   @param {Function} error An error callback
   @return {jqXHR} The jQueryXHR object for the AJAX request
*/
plugins.load = function(url,ready,error) {
    if (name.indexOf(".js",name.length-3) === -1) {
	if (name.indexOf(".plg",name.length-4) === -1) {
	    url = url+".plg"; }
	url = url + ".js";
    }
    return $.ajax({
	url: url,
	dataType: "script",
	success: ready,
	error: error,
	global: false
    });
}

/**
   Sets up a plugin constructor and adds it to the list, initializing it immediately
   depending on the value of plugins.loaded.
   @class Plugin
   @constructor
   @param {Function} func The plugin constructor
   @param {Object} proto The plugin prototype
*/
Plugin = function (func,proto) {
    for (i in proto) {
	this[i] = proto[i];
    }
    func.prototype = this;
    plugins.push(func);
    if (plugins.loaded) {
	new func(); }
};
Plugin.prototype = {
    register: function(type,callback) {
	plugins.handlers[type] || plugins.handlers[type] = [];
	return plugins.handlers[type].push($.proxy(callback,this));
    },
    useFilter: function(regex,callback) {
	plugins.handlers[regex] || plugins.handlers[regex] = [];
	return plugins.handlers[regex].push($.proxy(callback,this));
    }
};
