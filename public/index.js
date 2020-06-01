var localVideo;
var localStream;
var displayMediaOptions = {
  mandatory: {
    chromeMediaSource: "screen",
  },
};

// toggle mic icon
$("#micToggle").click(function () {
  $(this).toggleClass("fa-microphone fa-microphone-slash");
});

// toggle video icon
$("#videoToggle").click(function () {
  $(this).toggleClass("fa-video fa-video-slash");
});

// toggle mic event
$("#micToggle").click(function (event) {
  localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0]
    .enabled;
});

// toggle video event
$("#videoToggle").click(function () {
  localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0]
    .enabled;
});

// trigger screen share
$("#share").click(function (event) {
  $(this).toggleClass("start stop");
  startCapture();
});

// screen share and notification
async function startCapture(displayMediaOptions) {
  console.log("start capture");
  let captureStream = null;

  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    );
    screenVideo = document.getElementById("screenVideo");
    screenVideo.srcObject = captureStream;
    var notify = new Notification("You're presenting to everyone", {
      body: "Click here to return to the video call",
    });
  } catch (err) {
    console.error("Error: " + err);
  }
  return captureStream;
}

// GUM handle
navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    localVideo = document.getElementById("localVideo");
    localVideo.volume = 0;
    localStream = stream;
    localVideo.srcObject = stream;
    recognition.start();
  })
  .catch((error) => {
    console.log(error);
  });

//  speech recognition
window.SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
let finalTranscript = "";
let recognition = new window.SpeechRecognition();

recognition.interimResults = true;
recognition.maxAlternatives = 10;
recognition.continuous = true;

recognition.onresult = (event) => {
  if (localStream.getAudioTracks()[0].enabled) {
    let interimTranscript = "";
    for (let i = event.resultIndex, len = event.results.length; i < len; i++) {
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

// hide tooltip title on hover
$(document).ready(function () {
  $('[data-toggle="tooltip"]').tooltip();
  $("#micToggle").hover(function () {
    $('[data-toggle="tooltip"]').tooltip("hide");
  });
});
