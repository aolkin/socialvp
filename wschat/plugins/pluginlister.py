from tornado import web
import os,sys

class ListingHandler(web.RequestHandler):
    def get(self):
        plugins = {}
        for i in os.listdir(sys.modules["__main__"].staticpath+"/plugins"):
            if i.endswith(".plg.js"):
                plugins[i[:-7]] = i
        self.write(plugins)

handler = ('/pluginlist',ListingHandler)
