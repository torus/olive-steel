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
    var circle = makeAvatar();
    circle.x = Math.random() * stageWidth;
    circle.y = Math.random() * stageHeight;
    stage.addChild(circle);

    stage.update();

    return [stage, circle];
}

function makeAvatar() {
    var circle = new createjs.Shape();
    circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);

    return circle;
}

$(document).ready(function() {
    var res = init();
    var stage = res[0];
    var circle = res[1];

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
                users = str.split(", ");
                refreshUsers();
            }

            $('#join-section').hide();
            $('#chat-section').show();
            $('#users-section').show();

            ws.onmessage = onMessage(user, stage, avatars);

        } else {
            $('#warnings').append(event.data);
            ws.close();
        }
    };

    var destX = circle.x;
    var destY = circle.y;
    stage.addEventListener("click", function(event) {
	console.log([event.rawX, event.rawY]);
	destX = event.rawX;
	destY = event.rawY;

	ws.send(JSON.stringify({x: destX, y: destY}));
    });

    createjs.Ticker.addEventListener("tick", function(event) {
	if (circle.x != destX) {
	    circle.x += 0.1 * (destX - circle.x);
	}
	if (circle.y != destY) {
	    circle.y += 0.1 * (destY - circle.y);
	}
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

var users = [];

function refreshUsers() {
    $('#users').html('');
    for(i in users) {
        $('#users').append($(document.createElement('li')).text(users[i]));
    }
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
		    stage.addChild(avatars[who] = makeAvatar());
		}
		var avatar = avatars[who];
		avatar.x = action.x;
		avatar.y = action.y;
	    }
	} else {
	    var join = event.data.match(/(.*) (joined|disconnected)$/);
	    console.log(join[1] + " " + join[2]);
	}
    }
}
