wt = {files:{}};

size = 1024;
sizes = {};
sizes.kb = size;
sizes.mb = size*size;
sizes.gb = size*size*size;
sizes.block = sizes.mb*8;
sizes.localBlock = sizes.mb*32;
sizes.fs = sizes.gb*12;

windowSize = 1;
windowTimeout = 30*1000; // 30 seconds

fnSize = 64;

requestFS = self["requestFileSystemSync"] || self["webkitRequestFileSystemSync"];
requestAsyncFS = self["requestFileSystem"] || self["webkitRequestFileSystem"];
wt.fs = requestFS(PERSISTENT,sizes.fs);
requestAsyncFS(PERSISTENT,sizes.fs,function(fs){wt.afs=fs;},function(e){postMessage(e);});

function initFile(file,size) {
    file.peers = {};
    file.blocks = new Uint8Array(Math.ceil(size/sizes.block));
    file.completeBlocks = 0;
    file.rollWin = {};
    file.rollWin.length = 0;
}

function startFile(name,size) {
    wt.files[name] = wt.fs.root.getFile(name,{create:true});
    writer = wt.files[name].createWriter();
    for (i=0; i<size; i=i+sizes.localBlock) {
	writer.write(new Blob([new Uint8Array(sizes.localBlock).buffer],
			      {type:"application/octet-stream"}));
	postMessage({type:"progress",step:"preparation",percentage:i/size,
		     timestamp:new Date().getTime()/1000})
    }
    writer.truncate(size);
    postMessage({type:"progress",step:"preparation",percentage:1,
		 timestamp:new Date().getTime()/1000})
    initFile(wt.files[name],size);
    wt.files[name].complete = false;
    postMessage({type:"fileinfo",bloburl:URL.createObjectURL(wt.files[name].file()),
		 name:name,size:size});
}

function requestBlock(file,block) {
    peers = [];
    for (peer in wt.files[file].peers) {
	if (wt.files[file].peers[peer][block]) {
	    peers.push(peer); }
    }
    if (!peers.length) { postMessage(wt.files[file].peers); return false; }
    peerName = peers[Math.floor(Math.random()*peers.length)];
    if (!wt.files[file].rollWin[block]) { wt.files[file].rollWin.length++; }
    wt.files[file].rollWin[block] = new Date().getTime();
    ws.send(JSON.stringify({
	type: "request", to: peerName,
	file: file, block: block
    }));
    return true;
}

function writeBlock(file,block,blob) {
    // if (blob.size !== sizes.block) { throw RangeError("Blob is not block-sized"); }
    // ^^^ Had to scrap that because the last block will probably not be full size. ^^^
    writer = wt.files[file].createWriter();
    writer.seek(block*sizes.block);
    writer.write(blob);
    if (!wt.files[file].blocks[block]) {
	wt.files[file].completeBlocks++; }
    wt.files[file].blocks[block] = 1;
    delete wt.files[file].rollWin[block];
    wt.files[file].rollWin.length--;
    postMessage({type:"progress",step:"download",timestamp:new Date().getTime()/1000,
		 percentage:wt.files[file].completeBlocks/wt.files[file].blocks.length,
		 block:block,file:file});
}

onmessage = function(e) {
    if (e.data.action == "start") {
	startFile(e.data.name,e.data.size);
    } else if (e.data.action == "file") {
	name = e.data.file.name;
	wt.files[name] = wt.fs.root.getFile(name,{create:true});
	filecopied = (function filecopied(e) {
	    postMessage({type:"progress",timestamp:new Date().getTime()/1000,
			 step:"filecopy",percentage:1})
	    postMessage({type:"filecopied",name:this.name,size:this.size,
			 bloburl:URL.createObjectURL(wt.files[this.name].file())});
	}).bind({name:name,size:e.data.file.size});
	if (wt.files[name].file().size !== e.data.file.size) {
	    wt.files[name].createWriter().truncate(0);
	    wt.afs.root.getFile(name,{},function(entry) {
		entry.createWriter(function(writer) {
		    writer.onerror = postMessage;
		    writer.onwrite = filecopied;
		    writer.onprogress = function(e){
			postMessage({type:"progress",timestamp:new Date().getTime()/1000,
				     step:"filecopy",percentage:e.loaded/e.total})
		    }
		    writer.write(e.data.file);
		},postMessage);
	    },postMessage);
	} else {
	    filecopied(null); }
	initFile(wt.files[name],e.data.file.size);
	for (i=0;i<wt.files[name].blocks.length;i++) {
	    wt.files[name].blocks[i] = 1; }
	wt.files[name].complete = true;
    } else {
	postMessage(e.data);
    }
};

reader = new FileReaderSync();

ws = new WebSocket("ws://"+location.hostname+":"+(Number(location.port)+1)+"/webtorrent",
		   [location.hash.slice(1)]);
ws.onmessage = function(e) {
    if (typeof e.data == "string") {
	data = JSON.parse(e.data);
	if (data.type == "tracking") {
	    file = wt.files[data.file];
	    if (!file) { return false; }
	    file.peers[data.from] = data.blocks;
	} else if (data.type == "request") {
	    file = wt.files[data.file];
	    if (file && file.blocks[data.block]) {
		paddedname = data.file + new Array(fnSize-data.file.length).join(" ");
		block = new Uint16Array(1);
		block[0] = data.block;
		blobargs = ["\x00",data.from,"\x00",paddedname,String(new Date().getTime()),
			    block,reader.readAsArrayBuffer(file.file().slice(
				data.block*sizes.block,(data.block+1)*sizes.block))]
		ws.send(new Blob(blobargs));
		postMessage("Data sent!");
	    }
	} else if (data.type == "quit") {
	    for (i in wt.files) {
		if (wt.files[i].peers[data.who]) {
		    delete wt.files[i].peers[data.who]; }
	    }
	}
    } else {
	buffer = reader.readAsArrayBuffer(e.data);
	file = String.fromCharCode.apply(null,new Uint8Array(buffer.slice(1,fnSize))).trim();
	time = String.fromCharCode.apply(null,new Uint8Array(buffer.slice(fnSize,fnSize+13)));
	postMessage([Number(time),new Date().getTime(),new Date().getTime()-Number(time)]);
	block = new Uint16Array(buffer.slice(fnSize+13,fnSize+13+2))[0];
	blob = new Blob([buffer.slice(fnSize+13+2)]);
	writeBlock(file,block,blob);
    }
}
ws.onclose = ws.onerror = function(e) {
    postMessage(JSON.stringify(e));
    postMessage("killme");
}

function process() {
    for (i in wt.files) {
	file = wt.files[i];
	if (file.complete === false) {
	    complete = true;
	    for (p=0; p<file.blocks.length; p++) {
		if (file.blocks[p] === 0) {
		    complete = false;
		    if ((file.rollWin[p] === undefined && file.rollWin.length < windowSize) ||
			file.rollWin[p] < new Date().getTime()-windowTimeout) {
			result = requestBlock(i,p);
			postMessage("Requesting block "+p);
			break ;
		    }
		}
	    }
	    wt.files[i].complete = complete;
	}
    }
    setTimeout(process,500);
}

function broadcastTracking() {
    for (i in wt.files) {
	blocks = wt.files[i].blocks;
	ws.send(JSON.stringify({
	    type: "tracking",
	    file: i, blocks: wt.files[i].blocks 
	}));
    }
    setTimeout(broadcastTracking,5000);
}

setTimeout(process,1000);
setTimeout(broadcastTracking,500);

postMessage("Worker loaded!");
