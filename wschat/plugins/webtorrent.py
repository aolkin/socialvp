from tornado import websocket

class WebTorrentHandler(websocket.WebSocketHandler):
    def open(self):
        pass

    def on_message(self,message):
        pass

    def on_close(self):
        pass

handler = (r'/webtorrent',WebTorrentHandler)
