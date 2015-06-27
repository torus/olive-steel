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

var NoopStream = function() {
};
NoopStream.prototype.head = function head() {
    return function() {};
};

NoopStream.prototype.tail = function tail() {
    return new NoopStream;
};

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

    var streamBox = [new NoopStream];

    ws.onmessage = function(event) {
	console.log(event);
        if(event.data.match('^Welcome! Users: ')) {
            /* Calculate the list of initial users */
            var str = event.data.replace(/^Welcome! Users: /, '');
            if(str != "") {
		var names = str.split(", ");
                for (var idx in names) {
		    var name = names[idx];
		    var av = avatars[name] = makeAvatar();
		    stage.addChild(av.shape);
		    console.log("avatar spawned", name)
		}
            }

            ws.onmessage = onMessage(user, stage, avatars, streamBox);
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
	// avatar.move = move;
	ws.send(JSON.stringify({move: move}));
	streamBox[0] = new MergedStream(streamBox[0], new MoveStream(avatar, move));
    });

    createjs.Ticker.addEventListener("tick", function(event) {
	// for (var a in avatars) {
	//     avatars[a].updatePosition();
	// }
	// avatar.updatePosition();
	streamBox[0].head()();
	streamBox[0] = streamBox[0].tail();
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

var MoveStream = function MoveStream(avatar, move) {
    this.avatar = avatar;
    this.move = move;
};

MoveStream.prototype.head = function() {
    var avatar = this.avatar;
    var move = this.move;

    return function() {
	var circle = avatar.shape;

	var currTime = new Date().getTime();
	if (move.endTime > currTime) {
	    var newpos = interpolate(move.startPos, move.endPos, move.startTime, move.endTime, currTime);
	    circle.x = newpos.x;
	    circle.y = newpos.y;
	} else {
	    circle.x = move.endPos.x;
	    circle.y = move.endPos.y;

	    console.log("arrived.");
	}

	avatar.updatePosition();
    }
}

MoveStream.prototype.tail = function() {
    if (!this.move) {
	return null;
    }
    var currTime = new Date().getTime();
    if (this.move.endTime < currTime) {
	return null;
    }
    return new MoveStream(this.avatar, this.move);
};

var MergedStream = function(s1, s2) {
    this.stream1 = s1;
    this.stream2 = s2;
};

MergedStream.prototype.head = function() {
    var self = this;
    return function() {
	self.stream1.head()();
	self.stream2.head()();
    };
};

MergedStream.prototype.tail = function() {
    var t1 = this.stream1.tail();
    var t2 = this.stream2.tail();
    if (t1 && t2) {
	return new MergedStream(t1, t2);
    } else {
	return t1 || t2;
    }
};

function onMessage(user, stage, avatars, streamBox) {
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
		    // avatar.setMove(move.startPos, move.endPos, move.startTime, move.endTime);
		    streamBox[0] = new MergedStream(streamBox[0], new MoveStream(avatar, move));
		}
	    }
	} else {
	    var join = event.data.match(/(.*) (joined|disconnected)$/);
	    console.log(join[1] + " " + join[2]);
	    if (join[2] == "disconnected") {
		var av = avatars[join[1]];
		if (av) {
		    stage.removeChild(av.shape);
		    delete avatars[join[1]];
		}
	    }
	}
    }
}
