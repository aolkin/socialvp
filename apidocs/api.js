YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "client.api.Plugin",
        "client.api.plugins",
        "client.core.WSChat",
        "client.core.svp",
        "protocols.WebTorrent"
    ],
    "modules": [
        "PluginAPI",
        "SVP",
        "WSChat",
        "webtorrent.py"
    ],
    "allModules": [
        {
            "displayName": "PluginAPI",
            "name": "PluginAPI",
            "description": "A reusable and generic plugin API."
        },
        {
            "displayName": "SVP",
            "name": "SVP",
            "description": "Social Video Player"
        },
        {
            "displayName": "webtorrent.py",
            "name": "webtorrent.py",
            "description": "WebTorrent server plugin module"
        },
        {
            "displayName": "WSChat",
            "name": "WSChat",
            "description": "WSChat Client"
        }
    ]
} };
});