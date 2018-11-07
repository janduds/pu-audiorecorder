var EVENTS = ['start', 'stop', 'resume'];
var TYPES = ['audio/webm', 'audio/ogg', 'audio/wav'];
var recorder, list, recordFull, stop;
var timer_elem, seconds = 0, minutes = 0, hours = 0, timer_timeout, last_time;
var audio_format = null;

// Decibel Meter Vars
var bars = [];
var audioContext = window.AudioContext // Default
    || window.webkitAudioContext // Safari and old versions of Chrome
    || false; 

if (audioContext) {
    // Do whatever you want using the Web Audio API
    var audioContext = new AudioContext();
    // ...
} else {
    // Web Audio API is not supported
    // Alert the user
    alert("Sorry, but the Web Audio API is not supported by your browser. Please, consider upgrading to the latest version or downloading Google Chrome or Mozilla Firefox");
}
var input = null;
var analyser = null;
var scriptProcessor = null;
var drawing = false;
var waveform;

// Canvas related variables
var barWidth = 5;
var barGutter = barWidth / 1.5;
var barColor = "#fff";

var canvas, canvas2 = null;
var canvasContext = null;
var width = 0;
var height = 0;
var halfHeight = 0;
var max_vol;

// player vars
var duration,play_btn,time_end,time_start;


document.addEventListener('DOMContentLoaded', function () {
    list = document.getElementById('list');
    recordFull = document.getElementById('record');
    stop = document.getElementById('stop');
    timer_elem = document.getElementById('timer');

    if (MediaRecorder.notSupported) {
        list.style.display = 'none';
        document.getElementById('controls').style.display = 'none';
        document.getElementById('formats').style.display = 'none';
        document.getElementById('mode').style.display = 'none';
        document.getElementById('support').style.display = 'block';
        return;
    }
    document.getElementById('formats').innerText = 'Format: ' + TYPES.filter(function (i) {
        return MediaRecorder.isTypeSupported(i);
    }).join(', ');


    recordFull.addEventListener('click', startRecording.bind(null, 'full'));

    stop.addEventListener('click', stopRecording);

    recordFull.disabled = false;
    stop.style.display = "none";

    // Get the canvas element and context
    waveform = document.querySelector('.waveform');
    canvas = document.getElementById('canvas-1');
    canvas2 = document.getElementById('canvas-2');
    canvasContext = canvas.getContext('2d');
    canvasContext2 = canvas2.getContext('2d');

    // Set the dimensions
    width = canvas.offsetWidth;
    height = 32;

    halfHeight = height / 2;

    // Set the size of the canvas context to the size of the canvas element
    canvasContext.canvas.width = width;
    canvasContext.canvas.height = height;
    canvasContext2.canvas.width = width;
    canvasContext2.canvas.height = height;

    for (var i = 0; i <= width; ) {
        canvasContext2.fillStyle = '#aaaaaa';
        canvasContext2.fillRect(i, 0, barWidth, height);
        i = (i + barWidth) + barGutter;
    }

});

function add() {
    seconds++;
    if (seconds >= 60) {
        seconds = 0;
        minutes++;
        if (minutes >= 60) {
            minutes = 0;
            hours++;
        }
    }
    timer_elem.textContent = formatTime(hours, minutes, seconds);
    timer();
}

function formatTime(hours, minutes, seconds) {
//    return (hours ? (hours > 9 ? hours : "0" + hours) : "00") + ":" + (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds);
    return (minutes ? (minutes > 9 ? minutes : "0" + minutes) : "00") + ":" + (seconds > 9 ? seconds : "0" + seconds);
}

function getTime(t) {
    var m=~~(t/60), s=~~(t % 60);
    return (m<10?"0"+m:m)+':'+(s<10?"0"+s:s);
}

function timer() {
    timer_timeout = setTimeout(add, 1000);
}

function startRecording(type) {
    list.innerHTML = '';
    navigator.mediaDevices.getUserMedia({audio: true})
        .then(function (stream) {
            recorder = new MediaRecorder(stream);
            EVENTS.forEach(function (name) {
                recorder.addEventListener(name, changeState.bind(null, name));
            });
            recorder.addEventListener('dataavailable', saveRecord);
            if (type === 'full') {
                recorder.start();
            } else {
                recorder.start(1000);
            }

            timer();
            timer_elem.textContent = formatTime(hours, minutes, seconds);

            // decibel

            input = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            scriptProcessor = audioContext.createScriptProcessor();

            analyser.smoothingTimeConstant = 0.3;
            analyser.fftSize = 1024;

            input.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);

            scriptProcessor.onaudioprocess = processInput;


        })
        .catch(function (err) {
            /* handle the error */
            window.console.log(err);
        });

    recordFull.style.display = "none";
    stop.style.display = "block";
    timer_elem.style.display = "block";
    waveform.style.display = "block";
    recordFull.innerHTML = "Record";
}

function stopRecording() {
    recorder.stop();
    clearTimeout(timer_timeout);
    seconds = 0;
    recorder.stream.getTracks()[0].stop();
    stop.blur();
    recordFull.style.display = "block";
    stop.style.display = "none";
    timer_elem.style.display = "none";
    waveform.style.display = "none";
    input = null;
    recordFull.innerHTML = "Retry";

}

function saveRecord(e) {
    var li = document.createElement('li');
    audio = document.createElement('audio');
    var source_elem = document.createElement('source');

    audio.controls = false;
    var src = URL.createObjectURL(e.data);
    source_elem.setAttribute('src', src);
    source_elem.setAttribute('type', audio_format);
    audio.appendChild(source_elem);


    audio.onloadedmetadata = function() {
        var player = createPlayer(audio);
        
        play_btn = player.querySelector('.play');
        time_end = player.childNodes[4];
        time_start = player.childNodes[2];
        getDuration(src, function (time) {
            time_end.innerHTML = getTime(time);
        });
   
        li.appendChild(audio);
        li.appendChild(player);
        list.appendChild(li);

        play_btn.addEventListener('click', function () {
            audio[audio.paused ? 'play' : 'pause']();
            this.className = audio.paused ? 'play fa-play ctrl-btn' : 'play fa-pause ctrl-btn';
        });
        
        audio.addEventListener("ended", function(){ play_btn.className = 'play fa-play ctrl-btn'; }, false);
        audio.addEventListener("timeupdate", function () {
            time_start.innerHTML = getTime(audio.currentTime);
        }, false);
    };
}

var getDuration = function (url, next) {
    var _player = new Audio(url);
    _player.addEventListener("durationchange", function (e) {
        if (this.duration != Infinity) {
            var duration = this.duration
            _player.remove();
            next(duration);
        }
        ;
    }, false);
    _player.load();
    _player.currentTime = 24 * 60 * 60; //fake big time
    _player.volume = 0;
    var playPromise = _player.play();

// In browsers that don’t yet support this functionality,
// playPromise won’t be defined.
    if (playPromise !== undefined) {
        playPromise.then(function () {
            // Automatic playback started!
        }).catch(function (error) {
            // Automatic playback failed.
            // Show a UI element to let the user manually start playback.
            window.console.log(error);
        });
    }
    //waiting...
};

function changeState(eventName) {
    var debug_txt = "";
    debug_txt = eventName + ' ' + recorder.state;
    if (eventName === 'start') {
        debug_txt += ', ' + recorder.mimeType;
        audio_format = recorder.mimeType;
    }
    
    if (recorder.state === 'recording') {
        recordFull.disabled = true;
        stop.disabled = false;
    } else if (recorder.state === 'paused') {
        recordFull.disabled = true;
        stop.disabled = false;
    } else if (recorder.state === 'inactive') {
        recordFull.disabled = false;
        stop.disabled = true;
    }
}

function processInput(audioProcessingEvent) {
    var tempArr = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(tempArr);
    bars.push(getAverageVolume(tempArr));
    renderBars(getAverageVolume(tempArr));
}

function getAverageVolume(array) {
    var len = array.length;
    max_vol = len;
    var values = 0;
    for (var i = 0; i < len; i++) {
        values += array[i];
    }
    return values / len;
}

function renderBars(bar) {
    bar = (bar * width / max_vol) * 10;
    if (!drawing) {
        drawing = true;
        window.requestAnimationFrame(function () {
            canvasContext.clearRect(0, 0, width, height);
            for (var i = 0; i <= bar; ) {
                canvasContext.fillStyle = "orange";
                canvasContext.fillRect(i, 0, barWidth, height);
                i = (i + barWidth) + barGutter;
            }
            drawing = false;
        });

        drawing = false;
    }
}


function createPlayer(audio_elem) {
    var temp = document.createElement('div');
    temp.className = 'audio-player';
    temp.innerHTML = `<div id="controls" class="controls">
                    <i id="play" class="play fa-play ctrl-btn"></i>
                    <div id="progressbar" class="progressbar"><span></span></div>
                </div>
                <span id="start-time" class="start-time time">00:00</span>
                <span id="time" class="end-time time">00:00</span>`;
    return temp;
}