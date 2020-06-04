var VideoChat = {
  localICECandidates: [],
  connected: false,
  socket: io(),
  localVideo: document.getElementById("localVideo"),
  screenVideo: document.getElementById("screenVideo"),
  screenButton: document.getElementById("share"),
  micButton: document.getElementById("micToggle"),
  videoButton: document.getElementById("videoToggle"),
  servers_config: {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  },
  mediaConstraints: {
    audio: true,
    video: true,
  },
  screenConstraints: {
    mandatory: {
      chromeMediaSource: "screen",
    },
  },

  requestMediaStream: function (event) {
    navigator.mediaDevices
      .getUserMedia(VideoChat.mediaConstraints)
      .then((stream) => VideoChat.onMediaStream(stream))
      .catch((error) => VideoChat.onMediaError(error));
  },

  onMediaStream: function (stream) {
    VideoChat.localVideo.volume = 0;
    VideoChat.localVideo.srcObject = stream;
    VideoChat.localStream = stream;
    VideoChat.voiceRecognition();
    VideoChat.onToken(VideoChat.createOffer);
    VideoChat.socket.emit("join", "test");

    VideoChat.socket.on("offer", VideoChat.onOffer);
  },
  onMediaError: function (error) {
    console.log(error);
  },
  requestDisplayStream: function (event) {
    navigator.mediaDevices
      .getDisplayMedia(VideoChat.screenConstraints)
      .then((stream) => VideoChat.onScreenStream(stream))
      .catch((error) => VideoChat.onScreenError(error));
  },
  onScreenStream: function (stream) {
    var tempStream = VideoChat.localStream;
    VideoChat.localVideo.srcObject = stream;
    VideoChat.localStream = stream;

    VideoChat.pushNotification();
    VideoChat.onToken(VideoChat.createOffer);
    VideoChat.localStream.getVideoTracks()[0].onended = () => {
      VideoChat.localStream = tempStream;
      VideoChat.localVideo.srcObject = tempStream;
      VideoChat.onToken(VideoChat.createOffer);
    };
  },
  onScreenError: function (error) {
    console.log(error);
  },
  toggleMicIcon: function (event) {
    $(this).toggleClass("fa-microphone fa-microphone-slash");
    VideoChat.localStream.getAudioTracks()[0].enabled = !VideoChat.localStream.getAudioTracks()[0]
      .enabled;
  },
  toggleVideoIcon: function (event) {
    $(this).toggleClass("fa-video fa-video-slash");
    VideoChat.localStream.getVideoTracks()[0].enabled = !VideoChat.localStream.getVideoTracks()[0]
      .enabled;
  },
  voiceRecognition: function () {
    window.SpeechRecognition =
      window.webkitSpeechRecognition || window.SpeechRecognition;

    let recognition = new window.SpeechRecognition();

    recognition.interimResults = true;
    recognition.maxAlternatives = 10;
    recognition.continuous = true;
    let finalTranscript = "";
    recognition.start();
    recognition.onresult = (event) => {
      if (VideoChat.localStream.getAudioTracks()[0].enabled) {
        let interimTranscript = "";
        for (
          let i = event.resultIndex, len = event.results.length;
          i < len;
          i++
        ) {
          let transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        var speech_text = finalTranscript + interimTranscript;
        $("#speech").val(speech_text);
      } else {
        console.log("please unmute");
        $('[data-toggle="tooltip"]').tooltip("show");
      }
    };
  },
  pushNotification: function () {
    var notify = new Notification("You're presenting to everyone", {
      body: "Click here to return to the video call",
    });
    notify.onclick = function (x) {
      window.focus();
      this.close();
    };
  },
  onToken: function (callback) {
    VideoChat.peerConnection = new RTCPeerConnection(VideoChat.servers_config);

    // Add the local video stream to the peerConnection.
    VideoChat.peerConnection.addStream(VideoChat.localStream);
    // Set up callbacks for the connection generating iceCandidates or
    // receiving the remote media stream.
    VideoChat.peerConnection.onicecandidate = VideoChat.onIceCandidate;
    VideoChat.peerConnection.onaddstream = VideoChat.onAddStream;
    // Set up listeners on the socket for candidates or answers being passed
    // over the socket connection.
    VideoChat.socket.on("candidate", VideoChat.onCandidate);
    VideoChat.socket.on("answer", VideoChat.onAnswer);
    callback();
  },
  onIceCandidate: function (event) {
    if (event.candidate) {
      if (VideoChat.connected) {
        VideoChat.socket.emit("candidate", JSON.stringify(event.candidate));
      } else {
        // If we are not 'connected' to the other peer, we are buffering the local ICE candidates.
        // This most likely is happening on the "caller" side.
        // The peer may not have created the RTCPeerConnection yet, so we are waiting for the 'answer'
        // to arrive. This will signal that the peer is ready to receive signaling.
        VideoChat.localICECandidates.push(event.candidate);
      }
    }
  },
  onCandidate: function (candidate) {
    rtcCandidate = new RTCIceCandidate(JSON.parse(candidate));

    VideoChat.peerConnection.addIceCandidate(rtcCandidate);
  },

  // Create an offer that contains the media capabilities of the browser.
  createOffer: function () {
    console.log("offer creating");
    VideoChat.peerConnection.createOffer(
      function (offer) {
        // If the offer is created successfully, set it as the local description
        // and send it over the socket connection to initiate the peerConnection
        // on the other side.
        VideoChat.peerConnection.setLocalDescription(offer);
        VideoChat.socket.emit("offer", JSON.stringify(offer));
      },
      function (err) {
        // Handle a failed offer creation.
      }
    );
  },

  // Create an answer with the media capabilities that both browsers share.
  // This function is called with the offer from the originating browser, which
  // needs to be parsed into an RTCSessionDescription and added as the remote
  // description to the peerConnection object. Then the answer is created in the
  // same manner as the offer and sent over the socket.
  createAnswer: function (offer) {
    return function () {
      VideoChat.connected = true;
      rtcOffer = new RTCSessionDescription(JSON.parse(offer));
      VideoChat.peerConnection.setRemoteDescription(rtcOffer);
      VideoChat.peerConnection.createAnswer(
        function (answer) {
          console.log(answer);
          VideoChat.peerConnection.setLocalDescription(answer);
          VideoChat.socket.emit("answer", JSON.stringify(answer));
        },
        function (err) {
          // Handle a failed answer creation.
        }
      );
    };
  },

  // When a browser receives an offer, set up a callback to be run when the
  // ephemeral token is returned from Twilio.
  onOffer: function (offer) {
    VideoChat.onToken(VideoChat.createAnswer(offer));
  },

  // When an answer is received, add it to the peerConnection as the remote
  // description.
  onAnswer: function (answer) {
    var rtcAnswer = new RTCSessionDescription(JSON.parse(answer));
    VideoChat.peerConnection.setRemoteDescription(rtcAnswer);
    VideoChat.connected = true;
    VideoChat.localICECandidates.forEach((candidate) => {
      // The caller now knows that the callee is ready to accept new
      // ICE candidates, so sending the buffer over

      VideoChat.socket.emit("candidate", JSON.stringify(candidate));
    });
    // Reset the buffer of local ICE candidates. This is not really needed
    // in this specific client, but it's good practice
    VideoChat.localICECandidates = [];
  },

  // When the peerConnection receives the actual media stream from the other
  // browser, add it to the other video element on the page.
  onAddStream: function (event) {
    console.log("adding stream", event);
    VideoChat.remoteVideo = document.getElementById("remoteVideo");
    VideoChat.remoteVideo.srcObject = event.stream;
    VideoChat.remoteVideo.volume = 0.7;
  },
};

VideoChat.requestMediaStream();
VideoChat.screenButton.addEventListener(
  "click",
  VideoChat.requestDisplayStream,
  false
);

VideoChat.micButton.addEventListener("click", VideoChat.toggleMicIcon, false);

VideoChat.videoButton.addEventListener(
  "click",
  VideoChat.toggleVideoIcon,
  false
);

$(document).ready(function () {
  var currentUser = {};
  $("#modelId").modal("show");
  var $init_form = $("#init-form");
  var $register = $("#user-form");
  $register.submit(function (e) {
    e.preventDefault();
    VideoChat.socket.emit("new", { name: $("#username").val() }, function (
      data
    ) {
      if (data) {
        $(".username-text").text(data.name);
        $("#modelId").modal("hide");
        $("#currentUser").val(data.id);
        currentUser["id"] = data.id;
        currentUser["name"] = data.name;
      } else {
        console.log("Failed");
      }
    });
  });
  $init_form.submit(function (e) {
    e.preventDefault();
    var formdata = $(this).serializeArray();
    var req_data = {};
    $(formdata).each(function (index, obj) {
      req_data[obj.name] = obj.value;
    });

    VideoChat.socket.emit("msg", req_data);
  });

  $(document).on("submit", ".thread-form", function (e) {
    e.preventDefault();

    var formdata = $(this).serializeArray();
    var req_data = {};
    $(formdata).each(function (index, obj) {
      req_data[obj.name] = obj.value;
    });
    VideoChat.socket.emit("msg", req_data);
  });

  VideoChat.socket.on("thread", function (data) {
    console.log(data);
    if (data.parentId) {
      append_msg(data.message, data.userId, data.parentId);
      $(`#message_${data.parentId}`).find(".thread-form").remove();
      $(`#message_${data.parentId}:last`).append(
        `${thread_form(data.parentId, currentUser.id)}`
      );
    } else {
      create_thread(data.id);
      append_msg(data.message, data.userId, data.id);
      $(`#message_${data.id}:last`).append(
        `${thread_form(data.id, currentUser.id)}`
      );
    }
  });
  var userList = [];

  VideoChat.socket.on("update", function (users) {
    console.log(users);
    userList = users;
    $("#users").empty();
    for (var i = 0; i < userList.length; i++) {
      if (userList[i] != $(".username-text").text()) {
        $("#users:last").append("<li>" + userList[i] + "</li>");
      }
    }
  });
});

function append_msg(message, userId, id) {
  $(`#message_${id}:last`).append(
    `<p><span>${userId}: </span><span>${message}</span></p>`
  );
}
function create_thread(id) {
  return $(".user-chat-list").append(`<div id="message_${id}"></div>`);
}

function thread_form(parentId, userId) {
  return `<form class="thread-form" method="post">
    <input type="text" name="parentId" value="${parentId}" hidden />
    <input type="text" name="userId" value="${userId}" hidden />
    <div class="form-group chat-text">
      <textarea
        class="form-control"
        name="message"
        placeholder="Reply for the Thread......"
        rows="1"
      ></textarea>
      <button type="submit" class="btn btn-primary">Submit</button>
    </div>
  </form>`;
}
