function makeStage() {
    $("#demoCanvas").attr("style", "border: thin solid black");
    var stage = new createjs.Stage("demoCanvas");

    var stageWidth = stage.canvas.width;
    var stageHeight = stage.canvas.height;

    console.log(stage);
    var bg = new createjs.Shape();
    bg.graphics.beginFill("#eee").drawRect(0, 0, stageWidth, stageHeight);
    stage.addChild(bg);

    return stage;
}

function putLocalAvatar(stage) {
    var stageWidth = stage.canvas.width;
    var stageHeight = stage.canvas.height;

    var avatar = makeAvatar();
    avatar.shape.x = Math.random() * stageWidth;
    avatar.shape.y = Math.random() * stageHeight;
    stage.addChild(avatar.shape);

    return avatar;
}

var Avatar = function() {
    var circle = new createjs.Shape();
    circle.graphics.beginFill("DeepSkyBlue").drawCircle(0, 0, 20);

    this.move = null;
    this.shape = circle;
    this.heading = new b2Vec2(0, 0);
    this.state = 0;
}

function interpolate(start, end, startTime, endTime, currTime) {
    var d = endTime - startTime;
    var a = endTime - currTime;
    var b = currTime - startTime;

    return start.clone().mix(end, a / d);
    // return {x: (a * start.x + b * end.x) / d, y: (a * start.y + b * end.y) / d};
}

var Move = function Move(startPos, endPos, startTime, endTime) {
    this.startPos = startPos;
    this.endPos = endPos;
    this.startTime = startTime;
    this.endTime = endTime;
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

function onClick(user, avatar, ws) {
    return function(event) {
        console.log([event.rawX, event.rawY]);
	var destPos = new b2Vec2(event.rawX, event.rawY);
	var currPos = new b2Vec2(avatar.shape.x, avatar.shape.y);
        var currTime = new Date().getTime();
	var dist = destPos.clone().sub(currPos).Length();
        var endTime = currTime + (dist * 10 | 0);

        console.log(currPos, destPos, currTime, dist, endTime);

        var move = new Move(currPos, destPos, currTime, endTime);

        var state = avatar.state + 1;
        ws.send(JSON.stringify({move: move, state: state, avatar: user}));
    };
}

function onFirstMessage(stage, avatars, user, streamBox) {
    return function(event) {
        var ws = this;
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
}

b2Vec2.prototype.toJSON = function() {
    return {x: this.get_x(), y: this.get_y()};
};

b2Vec2.prototype.clone = function() {
    return new b2Vec2(this.get_x(), this.get_y());
};

b2Vec2.prototype.sub = function(v) {
    this.set_x(this.get_x() - v.get_x());
    this.set_y(this.get_y() - v.get_y());
    return this;
};

b2Vec2.prototype.mul = function(f) {
    this.set_x(this.get_x() * f);
    this.set_y(this.get_y() * f);
    return this;
};

b2Vec2.prototype.mix = function(v, r) {
    this.set_x(this.get_x() * r + v.get_x() * (1 - r));
    this.set_y(this.get_y() * r + v.get_y() * (1 - r));
    return this;
};

function updateBoids(boids, avatar) {
    var prob = createjs.Ticker.interval / 1000; // roughly once a second
    boids.concat([avatar]).forEach(function(b, i) {
        if (Math.random() < prob) {
            // console.log('updateBoids', i);
	    var boidPos = new b2Vec2(b.shape.x, b.shape.y);
            var localFlockmates = boids.filter(function(b2) {
                return b != b2 && boidPos.LengthSquared(new b2Vec2(b2.shape.x, b2.shape.y)) < 100000;
            });
	    var num = localFlockmates.length;
            var cohesion = localFlockmates.reduce(function(s, b2) {
		s.op_add(new b2Vec2(b2.shape.x, b2.shape.y));
                return s;
            }, new b2Vec2(0, 0)).mul(1 / num).sub(boidPos);

            var separation = localFlockmates.reduce(function(s, b2) {
		try {
		    var b2Pos = new b2Vec2(b2.shape.x, b2.shape.y);
                    var dd = boidPos.clone().sub(b2Pos).LengthSquared();
                    var vec = b2Pos.clone().sub(boidPos).mul(1 / dd);
                    s.op_add(vec);
		    return s;
		} catch(e) {
		    console.log({boidPos: boidPos, b2Pos: b2Pos, dd: dd, vec: vec, s: s, b2: b2});
		    createjs.Ticker.removeAllEventListeners();
		    console.log('stopped', e);
		}
            }, new b2Vec2(0, 0));
            var alignment = localFlockmates.reduce(function(s, b2) {
                
            }, new b2Vec2(0, 0));
        }
    });
}

$(document).ready(function() {
    var stage = makeStage();
    var avatar = putLocalAvatar(stage);

    var avatars = {};

    var user = "client" + (Math.random() * 100000 | 0);
    console.log("user", user);
    avatars[user] = avatar;

    var boids = (function(){
        for(var arr = []; arr.length < 10; arr.push(putLocalAvatar(stage))) ;
        return arr;
    })();
    var boidName = function(i) {
        return user + "-" + i;
    };
    boids.forEach(function(b, i) {
        var name = boidName(i);
        avatars[name] = b;
    });

    var ws = createWebSocket('/');

    ws.onopen = function() {
        ws.send('Hi! I am ' + user);
    };

    var streamBox = [new NoopStream];

    ws.onmessage = onFirstMessage(stage, avatars, user, streamBox);

    var destX = avatar.shape.x;
    var destY = avatar.shape.y;
    stage.addEventListener("click", onClick(user, avatar, ws));

    createjs.Ticker.addEventListener("tick", function(event) {
        streamBox[0].head()();
        streamBox[0] = streamBox[0].tail();
        updateBoids(boids, avatar);
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

var MoveStream = function MoveStream(avatar, move, state) {
    this.avatar = avatar;
    this.move = move;
    this.state = state;
};

MoveStream.prototype.head = function() {
    var avatar = this.avatar;
    var move = this.move;
    var state = this.state;

    return function() {
        var circle = avatar.shape;

        var currTime = new Date().getTime();
        if (avatar.state > state
            || move.startTime > currTime) {
            // do nothing
        } else if (move.endTime > currTime) {
            var newpos = interpolate(move.startPos, move.endPos, move.startTime, move.endTime, currTime);
            circle.x = newpos.get_x();
            circle.y = newpos.get_y();
        } else {
            circle.x = move.endPos.get_x();
            circle.y = move.endPos.get_y();

            console.log("arrived.");
        }

        if (avatar.state < state) {
            console.log("state", avatar.state, state);
            avatar.state = state;
        }
    }
}

MoveStream.prototype.tail = function() {
    if (!this.move) {
        return null;
    }
    if (this.avatar.state > this.state) {
        console.log("previous move canceled");
        return null;
    }

    var currTime = new Date().getTime();
    if (this.move.endTime < currTime) {
        return null;
    }
    return new MoveStream(this.avatar, this.move, this.state);
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
            var action = JSON.parse(match[2]);
            console.log(who, action);
            var avatarId = action.avatar
            if (avatarId) {
                if (!avatars[avatarId]) {
                    console.warn("avatar " + avatarId + " does not exist. spawning...");
                    var av = avatars[avatarId] = makeAvatar();
                    stage.addChild(av.shape);
                }
                var avatar = avatars[avatarId];
                var move = action.move;
                var state = action.state;
                if (move) {
		    var m = new Move(new b2Vec2(move.startPos.x, move.startPos.y),
				     new b2Vec2(move.endPos.x, move.endPos.y),
				     move.startTime, move.endTime);
                    streamBox[0] = new MergedStream(streamBox[0], new MoveStream(avatar, m, state));
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
