var express = require("express");
var app = express();
var http = require("http").createServer(app);
var io = require("socket.io")(http);

app.use(express.static("public"));

const models = require("./models/index");
models.sequelize.sync();

var users = {};
function updateClients() {
  io.sockets.emit("update", Object.keys(users));
}

io.on("connection", function (socket) {
  socket.on("join", function (room) {
    console.log("A client joined");
    var clients = io.sockets.adapter.rooms[room];
    var numClients = typeof clients !== "undefined" ? clients.length : 0;
    if (numClients == 0) {
      socket.join(room);
    } else if (numClients <= 25) {
      socket.join(room);
    } else {
      socket.emit("full", room);
    }
  });

  // Relay candidate messages
  socket.on("candidate", function (candidate) {
    console.log("Received candidate. Broadcasting...");
    socket.broadcast.emit("candidate", candidate);
  });

  // Relay offers
  socket.on("offer", function (offer) {
    console.log("Received offer. Broadcasting...");
    socket.broadcast.emit("offer", offer);
  });

  // Relay answers
  socket.on("answer", function (answer) {
    console.log("Received answer. Broadcasting...");
    socket.broadcast.emit("answer", answer);
  });
  socket.on("new", function (data, callback) {
    // trigger for findsor create user object
    create_user(data).then((user) => {
      callback(user);
    });

    socket.name = data.name;
    users[socket.name] = socket;
    updateClients();
  });

  // on new message
  socket.on("msg", function (data) {
    // trigger for creating message
    return create_message(data).then((message) => {
      io.emit("thread", message);
    });

    // io.to(users[data.to].emit("priv", data));
  });

  socket.on("disconnect", function () {
    delete users[socket["name"]];
    updateClients();
  });
});

async function create_user(data) {
  var user = models.user
    .findOrCreate({
      where: {
        name: data.name,
      },
    })
    .then(function (user, created) {
      return user[0];
    })
    .error(function (err) {
      console.log("Error occured" + err);
    });
  return user;
}

// creating message
async function create_message(data) {
  var message = models.message
    .create(data)
    .then(function (message, created) {
      return message;
    })
    .error(function (err) {
      console.log("Error occured" + err);
    });
  return message;
}

http.listen(3000, function () {
  console.log("listening on *:3000");
});
