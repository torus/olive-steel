function init() {
    $("#demoCanvas").attr("style", "border: thin solid black");
    var stage = new createjs.Stage("demoCanvas");

    var stageWidth = stage.canvas.width;
    var stageHeight = stage.canvas.height;

    console.log(stage);
    var bg = new createjs.Shape();
    bg.graphics.beginFill("#eee").drawRect(0, 0, stageWidth, stageHeight);
    stage.addChild(bg);

    // var circle = new createjs.Shape();
    // circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);
    var avatar = makeAvatar();
    avatar.shape.x = Math.random() * stageWidth;
    avatar.shape.y = Math.random() * stageHeight;
    avatar.setDest(avatar.shape.x, avatar.shape.y);
    stage.addChild(avatar.shape);

    stage.update();

    return [stage, avatar];
}

var Avatar = function() {
    var circle = new createjs.Shape();
    circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);

    this.destX = circle.x;
    this.destY = circle.y;
    this.shape = circle;
}

Avatar.prototype.setDest = function(x, y) {
    this.destX = x;
    this.destY = y;
}

Avatar.prototype.updatePosition = function() {
    var circle = this.shape;

    if (isNaN(this.destX) || isNaN(this.destY))
	return

    if (circle.x != this.destX) {
	circle.x += 0.1 * (this.destX - circle.x);
    }
    if (circle.y != this.destY) {
	circle.y += 0.1 * (this.destY - circle.y);
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
		    avatars[name] = makeAvatar();
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
	avatar.setDest(destX, destY);

	ws.send(JSON.stringify({x: destX, y: destY}));
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
		    stage.addChild(avatars[who] = makeAvatar());
		}
		var avatar = avatars[who];
		// avatar.x = action.x;
		// avatar.y = action.y;
		avatar.setDest(action.x, action.y);
	    }
	} else {
	    var join = event.data.match(/(.*) (joined|disconnected)$/);
	    console.log(join[1] + " " + join[2]);
	}
    }
}
