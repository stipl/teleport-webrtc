//Инициируем P2P 
var P2P = function (settings) {
	settings = settings || {};
	this.chat = settings.chat;
	this.peers = {};

	this.server = {
		iceServers: [
            { url: "stun:stun01.sipphone.com" },
			{ url: "stun:stun.ekiga.net" },
			{ url: "stun:stun.fwdnet.net" },
			{ url: "stun:stun.ideasip.com" },
			{ url: "stun:stun.iptel.org" },
			{ url: "stun:stun.rixtelecom.se" },
			{ url: "stun:stun.schlund.de" },
			{ url: "stun:stun.l.google.com:19302" },
			{ url: "stun:stun1.l.google.com:19302" },
			{ url: "stun:stun2.l.google.com:19302" },
			{ url: "stun:stun3.l.google.com:19302" },
			{ url: "stun:stun4.l.google.com:19302" },
			{ url: "stun:stunserver.org" },
			{ url: "stun:stun.softjoys.com" },
			{ url: "stun:stun.voiparound.com" },
			{ url: "stun:stun.voipbuster.com" },
			{ url: "stun:stun.voipstunt.com" },
			{ url: "stun:stun.voxgratia.org" },
			{ url: "stun:stun.xten.com" },
			{
				url: "turn:numb.viagenie.ca",
				credential: "muazkh",
				username: "webrtc@live.com"
			},
			{
				url: "turn:192.158.29.39:3478?transport=udp",
				credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
				username: "28224511:1379330808"
			},
			{
				url: "turn:192.158.29.39:3478?transport=tcp",
				credential: "JZEOEt2V3Qb0y27GRntt2u2PAYA=",
				username: "28224511:1379330808"
			}
		]
	};
};

var P2Proto = P2P.prototype;

P2Proto.initConnection = function (id, nickname) {
	var self = this;
	var localConnection = this._createConnection(id, nickname);

	localConnection.createOffer().then(function (offer) {
		localConnection.setLocalDescription(offer);
		self._sendOffer(id, localConnection);
	})


}

P2Proto.createDataChanel = function (id, connection) {
	var channel = connection.createDataChannel("RTCDataChannel");
	channel.owner = id;
	channel.caht = this.chat;
	this._getPeer(id).channel = channel;
	this.bindChannelEvents(channel);
}

P2Proto.remoteOfferReceived = function (id, data, name) {
	var self = this;
	var remoteConnection = this._createConnection(id, name);

	var remoteSessionDescription = this._createSessionDescription(data);
	remoteConnection.setRemoteDescription(remoteSessionDescription);
	remoteConnection.createAnswer().then(function (answer) {
		remoteConnection.setLocalDescription(answer);
		self._sendAnswer(id, remoteConnection);
	})


}

P2Proto.remoteAnswerReceived = function (id, data) {
	var peer = this._getPeer(id);
	var localConnection = peer.connection;
	localConnection.setRemoteDescription(this._createSessionDescription(data));
}

P2Proto.remoteCandidateReceived = function (id, data) {
	var peer = this._getPeer(id);
	peer.candidateCache.push(data);
	var connection = peer.connection;
	connection.addIceCandidate(this._createIceCandidate(data));
}

//биндим коэллбэки к коннекшену
P2Proto.bindConnectionEvents = function (id, connection) {
	var self = this;

	connection.onicecandidate = function (event) {
		var peer = self._getPeer(id);
		if (event.candidate) {
			peer.candidateCache.push(event.candidate);
		} else {
			for (var i = 0; i < peer.candidateCache.length; i++) {
				var data = {
					id: self.chat.ID,
					to: id,
					type: "candidate",
					data: peer.candidateCache[i]
				}
				self.chat.call("rtc", data)
			}
		}
	}

	connection.oniceconnectionstatechange = function (event) {
		console.log(connection.iceConnectionState)
		if (connection.iceConnectionState == "disconnected") {
			self._removePeer(id);
		}

	}
	connection.ondatachannel = function (e) {
		channel = event.channel;
		channel.owner = id;
		channel.chat = self.chat;
		channel.nick = self._getPeer(id).nickname;
		self.bindChannelEvents(channel);
	}
}

//Биндим ивенты к каналу
P2Proto.bindChannelEvents = function (channel) {
	var self = this;
	channel.onerror = function (error) {
		console.log("Data Channel Error:", error);
	};

	channel.onmessage = function (event) {
		channel.chat.routeMessage(channel.nick, event.data);
	};

	channel.onopen = function () {
		if (channel.readyState === 'open') {
			self.bindChannelEvents(channel);
		}
	};

	channel.onclose = function (event) {
		console.log("The Data Channel is Closed");
	};
}


//Добавляем пира в список известных
P2Proto._addPeer = function (id, connection, nickname) {
	this.peers[id] = {
		connection: connection,
		candidateCache: [],
		nickname: nickname
	};
}

//Достаем пира
P2Proto._getPeer = function (id) {
	return this.peers[id];
}

//Удаляем пира
P2Proto._removePeer = function (id) {
	delete this.peers[id];
}

//Создаем новое подключение типа RTCPeerConnection
P2Proto._createConnection = function (id, nickname) {
	var connClass = window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCSessionDescription
	var newConnection = new connClass(this.server);
	this._addPeer(id, newConnection, nickname);
	this.bindConnectionEvents(id, newConnection);
	this.createDataChanel(id, newConnection);
	return newConnection;
}

//создаем описание сессии коннекшена
P2Proto._createSessionDescription = function (data) {
	var sessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription || window.webkitRTCSessionDescription;
	return new sessionDescription(data);
}

//созадем кандидата
P2Proto._createIceCandidate = function (data) {
	var iceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate || window.webkitRTCIceCandidate;
	return new iceCandidate(data);
}

P2Proto._sendOffer = function (id, connection) {
	var data = {
		id: this.chat.ID,
		to: id,
		type: "offer",
		name: this.chat.nick,
		data: connection.localDescription
	}
	this.chat.call("rtc", data)
}

P2Proto._sendAnswer = function (id, connection) {
	var data = {
		id: this.chat.ID,
		to: id,
		type: "answer",
		data: connection.localDescription
	}
	this.chat.call("rtc", data)
}

P2Proto = null;