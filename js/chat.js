(function () {
	window.onload = function () {
		var chat = new Chat();
		chat.init(); //init chat settings
	};

})();

var Chat = function (settings) {
	settings = settings || {};

	this.chatContainer = document.getElementById("chat");
	this.loginContainer = document.getElementById("login");
	this.chatlog = document.getElementById("chat-log");
	this.message = document.getElementById("message-box");
	this.loginField = document.getElementById("login-field");
	this.userList = document.getElementById("userlist");

	this.Socket = null;
	this.P2P = null;
	this.ID = null;
	this.nick = null;
	this.arrayToWrite = [];
}

var CProto = Chat.prototype;

CProto.init = function () {
	$(this.chatContainer).hide();
	var self = this;
	$("#send-login").click(function (eventObject) {
		self.nick = self.loginField.value;
		self.connectToServer();
	});
}

CProto.connectToServer = function () {
	this.Socket = new WebSocket("ws://192.168.0.66:8080/");
	this.bindEvents();
}

CProto.bindEvents = function () {
	var self = this;
	this.Socket.onopen = function () {
		self.login();
	};

	this.Socket.onmessage = function (eventMessage) {
		self.receive(eventMessage);
	};

	this.Socket.onerror = function (error) {
		alert("Server connection error");
	};

	$(window).bind('beforeunload', function (eventObject) {
		self.logout();
	});

	$("#send-message").click(function (eventObject) {
		self.sendMessage();
	});

	$("#send-file").click(function (eventObject) {
		$("input").trigger("click");
	});

	document.querySelector('input[type=file]').onchange = function () {
		var file = this.files[0];
		var reader = new window.FileReader();
		reader.readAsDataURL(file);
		reader.onload = onReadAsDataURL;
		var chunkLength = 1000;
		function onReadAsDataURL(event, text) {
			var data = {
				type:"file"
			}; // data object to transmit over data channel

			if (event) text = event.target.result; // on first invocation

			if (text.length > chunkLength) {
				data.content = text.slice(0, chunkLength); // getting chunk using predefined chunk length
			} else {
				data.content = text;
				data.last = true;
			}

			self.sendFile(data); // use JSON.stringify for chrome!

			var remainingDataURL = text.slice(data.content.length);
			if (remainingDataURL.length) setTimeout(function () {
				onReadAsDataURL(null, remainingDataURL); // continue transmitting
			}, 500)
		}
	};
}

//TODO
CProto.login = function () {
	$(this.loginContainer).hide();
	$(this.chatContainer).show();

	this.ID = this.uuid();
	var userData = {
		nickname: this.nick,
		id: this.ID
	};
	this.P2P = new P2P({ chat: this });
	this.call("login", userData);
}

CProto.logout = function () {
	var peers = this.P2P.peers;
	for (var peer in peers) {
		if (peers.hasOwnProperty(peer)) {
			if (peers[peer].channel !== undefined) {
				peers[peer].channel.close();
			}
		}
	}
	this.Socket.close();
}

CProto.sendFile = function (data) {
	var peers = this.P2P.peers;
	for (var peer in peers) {
		if (peers.hasOwnProperty(peer)) {
			if (peers[peer].channel !== undefined) {
				try {
					peers[peer].channel.send(JSON.stringify(data));
				} catch (e) {
					console.log(e)
				}
			}
		}
	}
	if (data.last) {
		this.printMessage(this.nick, "File sended");
	}
}

CProto.sendMessage = function () {
	var msg = this.message.value;
	var peers = this.P2P.peers;
	for (var peer in peers) {
		if (peers.hasOwnProperty(peer)) {
			if (peers[peer].channel !== undefined) {
				try {
					var obj = {
						type: "text",
						content: msg
					}
					peers[peer].channel.send(JSON.stringify(obj));
				} catch (e) {
					console.log(e)
				}
			}
		}
	}
	this.printMessage(this.nick, msg);
	this.message.value = "";
}

CProto.routeMessage = function (user, message, type) {
	var data = JSON.parse(message);
	switch (data.type) {
		case "text": {
			this.printMessage(user, data.content, type);
		} break;
		case "file": {
			this.arrayToWrite.push(data.content); // pushing chunks in array
			if (data.last) {
				this.saveToDisk(this.arrayToWrite.join(''), 'fake fileName');
				this.arrayToWrite = []; // resetting array
			}
		} break;
		default:
			this.printMessage(user, data.content, type);
	}
}

CProto.printMessage = function (user, message, type) {
	var chatString;
	switch (type) {
		case "simple": {

		} break;
		default:
			chatString = "<div class='message message-simple'><b>" + user + "</b>: " + message + "</div>";
	}
	this.chatlog.innerHTML += chatString;
}

CProto.call = function (method, data) {
	var dataToSend = {
		method: method,
		data: data
	}
	this.Socket.send(JSON.stringify(dataToSend));
}

CProto.receive = function (eventMessage) {
	var incomming = JSON.parse(eventMessage.data);
	var method = incomming.method;
	var data = incomming.data;
	this.routeMethod(method, data)
}

CProto.routeMethod = function (method, data) {
	switch (method) {
		case "new": {
			//TODO add check to failed status
			this.updateUsers(data);
			this.initNewPeer(data);
		} break;
		case "leave": {
			this.updateUsers(data);
		} break;
		case "rtc": {
			this.routeRTC(data)
		} break;
		default: {

		}
	}
}

CProto.initNewPeer = function (data) {
	if (this.ID != data.id) {
		this.P2P.initConnection(data.id, data.nickname);
	}
}

CProto.updateUsers = function (data) {
	var self = this;
	while (self.userList.hasChildNodes()) {
		self.userList.removeChild(self.userList.lastChild);
	}
	data.nicknames.forEach(function (item, i, arr) {
		var messageElem = document.createElement('div');
		if (item == self.ID) {
			item = "+" + item;
		}
		messageElem.appendChild(document.createTextNode(item));
		self.userList.appendChild(messageElem);
	});
}

CProto.uuid = function () {
	var s4 = function () {
		return Math.floor(Math.random() * 0x10000).toString(16);
	};
	return s4() + s4() + "-" + s4() + "-" + s4() + "-" + s4() + "-" + s4() + s4() + s4();
}

CProto.routeRTC = function (incoming) {
	switch (incoming.type) {
		case "candidate":
			this.P2P.remoteCandidateReceived(incoming.id, incoming.data);
			break;
		case "offer":
			this.P2P.remoteOfferReceived(incoming.id, incoming.data, incoming.name);
			break;
		case "answer":
			this.P2P.remoteAnswerReceived(incoming.id, incoming.data);
			break;
	}
}
CProto.saveToDisk = function (fileUrl, fileName) {
	var save = document.createElement('a');
	save.href = fileUrl;
	save.target = '_blank';
	save.download = fileName || fileUrl;

	var evt = document.createEvent('MouseEvents');
	evt.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);

	save.dispatchEvent(evt);

	(window.URL || window.webkitURL).revokeObjectURL(save.href);
}
CProto = null;