wt = {files:{}};

size = 1024;
sizes = {};
sizes.kb = size;
sizes.mb = size*size;
sizes.gb = size*size*size;
sizes.block = sizes.mb*2;
sizes.localBlock = sizes.mb*32;
sizes.fs = sizes.gb*12;

windowSize = 4;
windowTimeout = 30*1000; // 20 seconds

fnSize = 64;

requestFS = self["requestFileSystemSync"] || self["webkitRequestFileSystemSync"];
wt.fs = requestFS(PERSISTENT,sizes.fs);

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
	postMessage({type:"progress",step:"preparation",percentage:i/size})
    }
    writer.truncate(size);
    initFile(wt.files[name],size);
    wt.files[name].complete = false;
    postMessage({type:"fileinfo",bloburl:URL.createObjectURL(wt.files[name].file()),
		 name:name,size:size});
}

function requestBlock(file,block) {
    peerChoice = false;
    for (peer in wt.files[file].peers) {
	peerChoice = wt.files[file].peers[peer];
	if (peerChoice[block]) { peerName = peer; break ; }
    }
    if (!peerChoice) { return false; }
    if (!wt.files[file].rollWin[block]) { wt.files[file].rollWin.length++; }
    wt.files[file].rollWin[block] = new Date().getTime();
    ws.send(JSON.stringify({
	type: "request", to: peerName,
	file: file, block: block
    }));
    return true;
}

function writeBlock(file,block,blob) {
    //if (blob.size !== sizes.block) { throw RangeError("Blob is not block-sized"); }
    writer = wt.files[file].createWriter();
    writer.seek(block*sizes.block);
    writer.write(blob);
    if (!wt.files[file].blocks[block]) {
	wt.files[file].completeBlocks++; }
    wt.files[file].blocks[block] = 1;
    delete wt.files[file].rollWin[block];
    wt.files[file].rollWin.length--;
    postMessage({type:"progress",step:"download",file:file,
		 percentage:wt.files[file].completeBlocks/wt.files[file].blocks.length})
}

onmessage = function(e) {
    if (e.data.action == "start") {
	startFile(e.data.name,e.data.size);
    } else if (e.data.action == "file") {
	name = e.data.file.name;
	wt.files[name] = wt.fs.root.getFile(name,{create:true});
	if (wt.files[name].file().size !== e.data.file.size) {
	    writer = wt.files[name].createWriter();
	    writer.write(e.data.file);
	    writer.truncate(e.data.file.size);
	}
	initFile(wt.files[name],e.data.file.size);
	for (i=0;i<wt.files[name].blocks.length;i++) {
	    wt.files[name].blocks[i] = 1; }
	wt.files[name].complete = true;
	postMessage({type:"filecopied",bloburl:URL.createObjectURL(wt.files[name].file()),
		     name:name,size:e.data.file.size});
    } else {
	postMessage(e.data);
    }
};

reader = new FileReaderSync();

ws = new WebSocket("ws://"+location.host+"/webtorrent",[location.hash.slice(1)]);
ws.onmessage = function(e) {
    if (typeof e.data == "string") {
	data = JSON.parse(e.data);
	if (data.type == "tracking") {
	    file = wt.files[data.file];
	    if (!file) { return false; }
	    file.peers[data.from] = data.blocks;
	} else if (data.type == "request") {
	    file = wt.files[data.file];
	    if (file.blocks[data.block]) {
		paddedname = data.file + new Array(fnSize-data.file.length).join(" ");
		block = new Uint16Array(1);
		block[0] = data.block;
		blobargs = ["\x00",data.from,"\x00",paddedname,block,
			    reader.readAsArrayBuffer(file.file().slice(
				data.block*sizes.block,(data.block+1)*sizes.block))]
		ws.send(new Blob(blobargs));
	    }
	}
    } else {
	buffer = reader.readAsArrayBuffer(e.data);
	file = String.fromCharCode.apply(null,new Uint8Array(buffer.slice(1,fnSize))).trim();
	block = new Uint16Array(buffer.slice(fnSize,fnSize+2))[0];
	blob = new Blob([buffer.slice(fnSize+2)]);
	postMessage([file,block,blob.size]);
	writeBlock(file,block,blob);
    }
}
ws.onclose = ws.onerror = function(e) {
    postMessage(e);
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
			if (result === false || file.rollWin.length >= windowSize) {
			    break ; }
		    }
		}
	    }
	    wt.files[i].complete = complete;
	}
    }
    setTimeout(process,2000);
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
