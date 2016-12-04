var WebSocketServer = new require('ws');

var clients = {};

var webSocketServer = new WebSocketServer.Server({
    port: 8080
});

webSocketServer.broadcast = function broadcast(data, ignore) {
    webSocketServer.clients.forEach(function each(client) {
        //if (client.uid != ignore) {
        //    client.send(data);
        //}
        client.send(data);
    });
};

webSocketServer.on('connection', function (socket) {

    socket.on('message', function (message) {
        var incoming = JSON.parse(message);
        var currentMethod = incoming.method;
        var data = incoming.data;
        switch (currentMethod) {
            case "login": {
                socket.nickname = data.nickname;
                socket.uid = data.id;
                login(data.id, socket);
            } break;
            case "rtc": {
                rctMessage(data, socket);
            } break;
            default: {

            }
        }
    });
    socket.on('close', function () {
        logout(socket.uid);
    });
});

var rctMessage = function (data, socket) {
    var to = data.to;
    var type = data.type;
    var data = {
        method: "rtc",
        data: data
    };
    if (to !== undefined && clients[to] !== undefined) {
        console.log(to + " : " + type);
        clients[to].send(JSON.stringify(data));
    } else {
        // ...иначе считаем сообщение широковещательным
        webSocketServer.broadcast(JSON.stringify(data))
    }
}

var getUserList = function () {
    var result = [];
    webSocketServer.clients.forEach(function each(client) {
        result.push(client.nickname);
    });
    return result;
}

var logout = function (id) {
    delete clients[id];
    var data = {
        method: "leave",
        data: {
            nicknames: getUserList()
        }
    };
    webSocketServer.broadcast(JSON.stringify(data), id)
}

var login = function (id, socket) {
    var data = null;
    if (clients[id] === undefined) {
        clients[id] = socket;
        data = {
            status: "added",
            method: "new",
            data: {
            	id: id,
            	nickname: socket.nickname,
                nicknames: getUserList()
            }
        };
    } else {
        data = {
            method: "new",
            status: "failed"
        };
    }
    webSocketServer.broadcast(JSON.stringify(data), id)
}