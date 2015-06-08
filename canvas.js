function init() {
    $("#demoCanvas").attr("style", "border: thin solid black");
    var stage = new createjs.Stage("demoCanvas");

    var stageWidth = stage.canvas.width;
    var stageHeight = stage.canvas.height;

    console.log(stage);
    var bg = new createjs.Shape();
    bg.graphics.beginFill("#eee").drawRect(0, 0, stageWidth, stageHeight);
    stage.addChild(bg);

    var avatar = makeAvatar();
    avatar.shape.x = Math.random() * stageWidth;
    avatar.shape.y = Math.random() * stageHeight;
    stage.addChild(avatar.shape);

    stage.update();

    return [stage, avatar];
}

var Avatar = function() {
    var circle = new createjs.Shape();
    circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);

    this.move = null;
    this.shape = circle;
}

function interpolate(start, end, startTime, endTime, currTime) {
    var d = endTime - startTime;
    var a = endTime - currTime;
    var b = currTime - startTime;
    return {x: (a * start.x + b * end.x) / d, y: (a * start.y + b * end.y) / d};
}

var Move = function Move(startPos, endPos, startTime, endTime) {
    this.startPos = startPos;
    this.endPos = endPos;
    this.startTime = startTime;
    this.endTime = endTime;
}

// Avatar.prototype.setDest = function(x, y) {
Avatar.prototype.setMove = function(startPos, endPos, startTime, endTime) {
    this.move = new Move(startPos, endPos, startTime, endTime);
}

Avatar.prototype.updatePosition = function() {
    var circle = this.shape;

    var move = this.move;
    if (move) {
	var currTime = new Date().getTime();
	if (move.endTime > currTime) {
	    var newpos = interpolate(move.startPos, move.endPos, move.startTime, move.endTime, currTime);
	    circle.x = newpos.x;
	    circle.y = newpos.y;
	} else {
	    circle.x = move.endPos.x;
	    circle.y = move.endPos.y;
	    this.move = null;
	    console.log("arrived.");
	}
    }
}

function makeAvatar() {
    return new Avatar();
}

$(document).ready(function() {
    var res = init();
    var stage = res[0];
    var avatar = res[1];

    var avatars = {};

    var user = "client" + (Math.random() * 100000 | 0);
    console.log("user", user);
    var ws = createWebSocket('/');

    ws.onopen = function() {
        ws.send('Hi! I am ' + user);
    };

    ws.onmessage = function(event) {
	console.log(event);
        if(event.data.match('^Welcome! Users: ')) {
            /* Calculate the list of initial users */
            var str = event.data.replace(/^Welcome! Users: /, '');
            if(str != "") {
                for (var name in str.split(", ")) {
		    var av = avatars[name] = makeAvatar();
		    stage.addChild(av.shape);
		}
            }

            ws.onmessage = onMessage(user, stage, avatars);
        } else {
            $('#warnings').append(event.data);
            ws.close();
        }
    };

    var destX = avatar.shape.x;
    var destY = avatar.shape.y;
    stage.addEventListener("click", function(event) {
	console.log([event.rawX, event.rawY]);
	destX = event.rawX;
	destY = event.rawY;

	var currX = avatar.shape.x;
	var currY = avatar.shape.y;
	var currTime = new Date().getTime();
	var dist = Math.sqrt((destX - currX) * (destX - currX) + (destY - currY) * (destY - currY));
	var endTime = currTime + (dist * 10 | 0);

	console.log(currX, currY, destX, destY, currTime, dist, endTime);

	var move = new Move({x: currX, y: currY},
			    {x: destX, y: destY},
			    currTime, endTime);
	avatar.move = move;
	ws.send(JSON.stringify({move: move}));
    });

    createjs.Ticker.addEventListener("tick", function(event) {
	for (var a in avatars) {
	    avatars[a].updatePosition();
	}
	avatar.updatePosition();
	stage.update();
    });

});

function createWebSocket(path) {
    var host = window.location.hostname;
    if(host == '') host = 'localhost';
    var uri = 'ws://' + host + ':9160' + path;

    var Socket = "MozWebSocket" in window ? MozWebSocket : WebSocket;
    return new Socket(uri);
}

function onMessage(user, stage, avatars) {
    return function(event) {
	console.log("onMessage", event);
	var match = event.data.match(/(.*)?: (.*)$/);
	if (match) {
	    var who = match[1];
	    if (who != user) {
		var action = JSON.parse(match[2]);
		console.log(who, action);
		if (!avatars[who]) {
		    console.warn("avatar " + who + " does not exist. spawning...");
		    var av = avatars[who] = makeAvatar();
		    stage.addChild(av.shape);
		}
		var avatar = avatars[who];
		var move = action.move;
		if (move) {
		    avatar.setMove(move.startPos, move.endPos, move.startTime, move.endTime);
		}
	    }
	} else {
	    var join = event.data.match(/(.*) (joined|disconnected)$/);
	    console.log(join[1] + " " + join[2]);
	}
    }
}
