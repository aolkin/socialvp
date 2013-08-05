/**
   A reusable and generic plugin API.

   @author Aaron Olkin

   @module PluginAPI
   @namespace client.api
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
   Holds arrays of event callbacks.
   @property handlers
   @private
*/
plugins.handlers = {};
/**
   Holds arrays of editor callbacks.
   @property editors
   @private
*/
plugins.editors = {};
/**
   Holds arrays of string filters.
   @property filters
   @private
*/
plugins.filters = {};

/**
   Loads all preloaded plugins and tells future plugins to load immediately.
   @method init
   @param {Mixed} it This argument is ignored at the moment
   @beta
*/
plugins.init = function (it) {
    for (i=0;i<plugins.length;i++) {
	new plugins[i](); }
    plugins.loaded = true;
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
   Core code should call this to allow plugins to make changes to arbitrary objects
   or change default behaviors.
   @method editor
   @param {Mixed} type Either a function (whose name will then be used) or a string
   @param {Mixed} object The object to edit
   @return {Mixed} The (possibly) edited object
*/
plugins.editor = function(type,object) {
    if (typeof type == "function") {
	type = type.name; }
    if (plugins.editors[type]) {
	for (i=0;i<plugins.editors[type].length;i++) {
	    object = plugins.editors[type][i](object,type);
	}
    }
    return object;
}

/**
   Creates a new element for a plugin to use.
   *This method is designed to be overwritten by the core code.*
   @method requestDiv
   @return {jQuery Array} a jQuery array containing a single div
*/
plugins.requestDiv = function() {
    return $("<div>").appendTo("body");
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
    /**
       Registers a event handler with the plugin API.
       @method register
       @param {String} type The event type to register with
       @param {Function} callback The method to register. It will be called in the context of the plugin.
       @return {Number} The registration ID, can be used to unregister the handler later.
    */
    register: function(type,callback) {
	this._register("handler",type,callback);
    },
    /**
       Registers a event handler with the plugin API.
       @method useEditor
       @param {String} type The edit type to register
       @param {Function} callback The method to register. It will be called in the context of the plugin.
       @return {Number} The registration ID, can be used to unregister the editor later.
    */
    useEditor: function(type,callback) {
	this._register("editor",type,callback);
    },
    /**
       Registers a string filter with the plugin API.
       @method useFilter
       @param {RegExp} regex This filter will only be applied if the regex matches
       @param {Function} callback The method to register. It will be called in the context of the plugin.
       @return {Number} The registration ID, can be used to unregister the filter later. (Note: unregistering is not implemented yet.)
    */
    useFilter: function(regex,callback) {
	this._register("filter",regex,callback);
    },
    _register: function(type,f,c) {
	plugins[type+"s"][f] || plugins[type+"s"][f] = [];
	return plugins[type+"s"][f].push($.proxy(c,this));
    }
};
