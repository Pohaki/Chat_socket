$(function() {
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    '#e21400', '#91580f', '#f8a700', '#f78b00',
    '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
    '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
  ];

  // Initialize variables
  var localStream, localPeerConnection, remotePeerConnection;
  var $window = $(window);
  var $usernameInput = $('.usernameInput'); // Input for username
  var $messages = $('.messages'); // Messages area
  var $inputMessage = $('.inputMessage'); // Input message input box

  var $loginPage = $('.login.page'); // The login page
  var $chatPage = $('.chat.page'); // The chatroom page

  var startButton = document.getElementById('startButton');
  var callButton = document.getElementById('callButton');
  var hangupButton = document.getElementById('hangupButton');
  callButton.disabled = true;
  hangupButton.disabled = true;
  startButton.onclick = start;
  callButton.onclick = call;
  hangupButton.onclick = hangup;

  var video1 = document.querySelector('video#video1');
  var video2 = document.querySelector('video#video2');
  var video3 = document.querySelector('video#video3');
  var video4 = document.querySelector('video#video4');

  var pc1Local;
  var pc1Remote;
  var pc2Local;
  var pc2Remote;
  var pc3Local;
  var pc3Remote;
  var offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  };

  // Prompt for setting a username
  var username;
  var rooms = ['room1', 'room2', 'room3'];
  var connected = false;
  var typing = false;
  var lastTypingTime;
  var $currentInput = $usernameInput.focus();

  var socket = io();

  function addParticipantsMessage(data) {
    var message = '';
    if (data.numUsers === 1) {
      message += "there's 1 participant";
    } else {
      console.log(data.room);
      message += "there are " + data.numUsers + " participants in " + data.room;
    }
    log(message);
  }

  // Video connection 3 participants
  function gotStream(stream) {
    trace('Received local stream');
    video1.srcObject = stream;
    window.localstream = stream;
    callButton.disabled = false;
  }

  function start() {
    trace('Requesting local stream');
    startButton.disabled = true;
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    .then(gotStream)
    .catch(function(e) {
      console.log('getUserMedia() error: ', e);
    });
  }
  function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    trace('Starting calls');
    var audioTracks = window.localstream.getAudioTracks();
    var videoTracks = window.localstream.getVideoTracks();
    if (audioTracks.length > 0) {
      trace('Using audio device: ' + audioTracks[0].label);
    }
    if (videoTracks.length > 0) {
      trace('Using video device: ' + videoTracks[0].label);
    }
    // Create an RTCPeerConnection via the polyfill.
    var servers = null;
    pc1Local = new RTCPeerConnection(servers);
    pc1Remote = new RTCPeerConnection(servers);
    pc1Remote.onaddstream = gotRemoteStream1;
    pc1Local.onicecandidate = iceCallback1Local;
    pc1Remote.onicecandidate = iceCallback1Remote;
    trace('pc1: created local and remote peer connection objects');

    pc2Local = new RTCPeerConnection(servers);
    pc2Remote = new RTCPeerConnection(servers);
    pc2Remote.onaddstream = gotRemoteStream2;
    pc2Local.onicecandidate = iceCallback2Local;
    pc2Remote.onicecandidate = iceCallback2Remote;
    trace('pc2: created local and remote peer connection objects');

    pc3Local = new RTCPeerConnection(servers);
    pc3Remote = new RTCPeerConnection(servers);
    pc3Remote.onaddstream = gotRemoteStream3;
    pc3Local.onicecandidate = iceCallback3Local;
    pc3Remote.onicecandidate = iceCallback3Remote;
    trace('pc3: created local and remote peer connection objects');

    pc1Local.addStream(window.localstream);
    trace('Adding local stream to pc1Local');
    pc1Local.createOffer(gotDescription1Local, onCreateSessionDescriptionError,
        offerOptions);

    pc2Local.addStream(window.localstream);
    trace('Adding local stream to pc2Local');
    pc2Local.createOffer(gotDescription2Local, onCreateSessionDescriptionError,
        offerOptions);

    pc3Local.addStream(window.localstream);
    trace('Adding local stream to pc3Local');
    pc3Local.createOffer(gotDescription3Local, onCreateSessionDescriptionError,
        offerOptions);
  }
  function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
  }

  function gotDescription1Local(desc) {
    pc1Local.setLocalDescription(desc);
    trace('Offer from pc1Local \n' + desc.sdp);
    pc1Remote.setRemoteDescription(desc);
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    pc1Remote.createAnswer(gotDescription1Remote,
        onCreateSessionDescriptionError);
  }
  function gotDescription1Remote(desc) {
    pc1Remote.setLocalDescription(desc);
    trace('Answer from pc1Remote \n' + desc.sdp);
    pc1Local.setRemoteDescription(desc);
  }

  function gotDescription2Local(desc) {
    pc2Local.setLocalDescription(desc);
    trace('Offer from pc2Local \n' + desc.sdp);
    pc2Remote.setRemoteDescription(desc);
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    pc2Remote.createAnswer(gotDescription2Remote,
        onCreateSessionDescriptionError);
  }

  function gotDescription2Remote(desc) {
    pc2Remote.setLocalDescription(desc);
    trace('Answer from pc2Remote \n' + desc.sdp);
    pc2Local.setRemoteDescription(desc);
  }
  function gotDescription3Local(desc) {
    pc3Local.setLocalDescription(desc);
    trace('Offer from pc2Local \n' + desc.sdp);
    pc3Remote.setRemoteDescription(desc);
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    pc3Remote.createAnswer(gotDescription3Remote,
        onCreateSessionDescriptionError);
  }

  function gotDescription3Remote(desc) {
    pc3Remote.setLocalDescription(desc);
    trace('Answer from pc2Remote \n' + desc.sdp);
    pc3Local.setRemoteDescription(desc);
  }

  function hangup() {
    trace('Ending calls');
    pc1Local.close();
    pc1Remote.close();
    pc2Local.close();
    pc2Remote.close();
    pc3Local.close();
    pc3Remote.close();
    pc1Local = pc1Remote = null;
    pc2Local = pc2Remote = null;
    pc3Local = pc3Remote = null;
    hangupButton.disabled = true;
    callButton.disabled = false;
  }

  function gotRemoteStream1(e) {
    video2.srcObject = e.stream;
    trace('pc1: received remote stream');
  }

  function gotRemoteStream2(e) {
    video3.srcObject = e.stream;
    trace('pc2: received remote stream');
  }

  function gotRemoteStream3(e) {
    video4.srcObject = e.stream;
    trace('pc2: received remote stream');
  }

  function iceCallback1Local(event) {
    handleCandidate(event.candidate, pc1Remote, 'pc1: ', 'local');
  }

  function iceCallback1Remote(event) {
    handleCandidate(event.candidate, pc1Local, 'pc1: ', 'remote');
  }

  function iceCallback2Local(event) {
    handleCandidate(event.candidate, pc2Remote, 'pc2: ', 'local');
  }

  function iceCallback2Remote(event) {
    handleCandidate(event.candidate, pc2Local, 'pc2: ', 'remote');
  }

  function iceCallback3Local(event) {
    handleCandidate(event.candidate, pc3Remote, 'pc3: ', 'local');
  }

  function iceCallback3Remote(event) {
    handleCandidate(event.candidate, pc3Local, 'pc3: ', 'remote');
  }

  function handleCandidate(candidate, dest, prefix, type) {
    if (candidate) {
      dest.addIceCandidate(new RTCIceCandidate(candidate),
          onAddIceCandidateSuccess, onAddIceCandidateError);
      trace(prefix + 'New ' + type + ' ICE candidate: ' + candidate.candidate);
    }
  }

  function onAddIceCandidateSuccess() {
    trace('AddIceCandidate success.');
  }

  function onAddIceCandidateError(error) {
    trace('Failed to add ICE candidate: ' + error.toString());
  }
  // Sets the client's username
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      $loginPage.fadeOut();
      $chatPage.show();
      $loginPage.off('click');
      $currentInput = $inputMessage.focus();

      // Tell the server your username
      socket.emit('add user', username);
    }
  }

  // Sends a chat message
  function sendMessage() {
    var message = $inputMessage.val();
    // Prevent markup from being injected into the message
    message = cleanInput(message);
    // if there is a non-empty message and a socket connection
    if (message && connected) {
      $inputMessage.val('');
      addChatMessage({
        username: username,
        message: message
      });
      // tell server to execute 'new message' and send along one parameter
      socket.emit('new message', message);
    }
  }

  // Log a message
  function log(message, options) {
    var $el = $('<li>').addClass('log').text(message);
    addMessageElement($el, options);
  }

  // Adds the visual chat message to the message list
  function addChatMessage(data, options) {
    // Don't fade the message in if there is an 'X was typing'
    var $typingMessages = getTypingMessages(data);
    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

    var $usernameDiv = $('<span class="username"/>')
      .text(data.username)
      .css('color', getUsernameColor(data.username));
    var $messageBodyDiv = $('<span class="messageBody">')
      .text(data.message);

    var typingClass = data.typing ? 'typing' : '';
    var $messageDiv = $('<li class="message"/>')
      .data('username', data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageBodyDiv);

    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping(data) {
    data.typing = true;
    data.message = 'is typing';
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function() {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement(el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === 'undefined') {
      options.fade = true;
    }
    if (typeof options.prepend === 'undefined') {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput(input) {
    return $('<div/>').text(input).text();
  }

  // Updates the typing event
  function updateTyping() {
    if (connected) {
      if (!typing) {
        typing = true;
        socket.emit('typing');
      }
      lastTypingTime = (new Date()).getTime();

      setTimeout(function() {
        var typingTimer = (new Date()).getTime();
        var timeDiff = typingTimer - lastTypingTime;
        if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
          socket.emit('stop typing');
          typing = false;
        }
      }, TYPING_TIMER_LENGTH);
    }
  }

  // Gets the 'X is typing' messages of a user
  function getTypingMessages(data) {
    return $('.typing.message').filter(function(i) {
      return $(this).data('username') === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor(username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }
  // Switch room
  function switchRoom(room) {
    socket.emit('switchRoom', room);
    console.log(room);
  }
  // Keyboard events

  $window.keydown(function(event) {
    // Auto-focus the current input when a key is typed
    if (!(event.ctrlKey || event.metaKey || event.altKey)) {
      $currentInput.focus();
    }
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username) {
        sendMessage();
        socket.emit('stop typing');
        typing = false;
      } else {
        setUsername();
      }
    }
  });
  $usernameInput.on('input', function() {
    trace();
    gotStream();
    getMedia();
    video();
    gotLocalDescription();
    gotRemoteDescription();
    gotRemoteStream();
    gotLocalIceCandidate();
    gotRemoteIceCandidate();
    handleError();

  });
  $inputMessage.on('input', function() {
    updateTyping();
  });

  // Click events

  // Focus input when clicking anywhere on login page
  $loginPage.click(function() {
    $currentInput.focus();
  });

  // Focus input when clicking on the message input's border
  $inputMessage.click(function() {
    $inputMessage.focus();
  });

  // Socket events

  // Whenever the server emits 'login', log the login message
  socket.on('login', function(data) {
    connected = true;
    // Display the welcome message
    var message = "Welcome to the Chat Test – ";
    log(message, {
      prepend: true
    });
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'new message', update the chat body
  socket.on('new message', function(data) {
    addChatMessage(data);
  });

  // Whenever the server emits 'user joined', log it in the chat body
  socket.on('user joined', function(data) {
    log(data.username + ' joined');
    addParticipantsMessage(data);
  });

  // Whenever the server emits 'user left', log it in the chat body
  socket.on('user left', function(data) {
    log(data.username + ' left');
    addParticipantsMessage(data);
    removeChatTyping(data);
  });

  // Whenever the server emits 'typing', show the typing message
  socket.on('typing', function(data) {
    addChatTyping(data);
  });

  // Whenever the server emits 'stop typing', kill the typing message
  socket.on('stop typing', function(data) {
    removeChatTyping(data);
  });
  // Whenever the server emits 'update rooms' switch room
  socket.on('update rooms', function(data) {
    $('#rooms').empty();
    $.each(data[rooms], function(key, value) {
      if (value == data[current_room]) {
        $('#rooms').append('<div>' + value + '</div>');
      } else {
        $('#rooms').append('<div><a href="#" onclick="switchRoom(\'' + value + '\')">' + value + '</a></div>');
      }
    });
    console.log(data.rooms, data.current_room);
  });
});
