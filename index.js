//var bytes = require('bytes');

var EVENTS = ['start', 'stop', 'pause', 'resume'];
var TYPES = ['audio/webm', 'audio/ogg', 'audio/wav'];
var recorder, list, recordFull, recordParts, pause, resume, stop, request;
// We'll store the value of te bars we want to draw in here
const bars = []

// An instance of AudioContext
const audioContext = new AudioContext();

// This will become our input MediaStreamSourceNode
let input = null;

// This will become our AnalyserNode
let analyser = null;

// This will become our ScriptProcessorNode
let scriptProcessor = null;

// Canvas related variables
const barWidth = 2;
const barGutter = 2;
const barColor = "#49F1D5";

let canvas = null;
let canvasContext = null;
let width = 0;
let height = 0;
let halfHeight = 0;
let drawing = false;

/**
 * Process the input of the ScriptProcessorNode.
 *
 * @param {audioProcessingEvent}
 */
const processInput = audioProcessingEvent => {  
    // Create a new Uint8Array to store the analyser's frequencyBinCount 
    const tempArray = new Uint8Array(analyser.frequencyBinCount);

    // Get the byte frequency data from our array
    analyser.getByteFrequencyData(tempArray);
    
    // Calculate the average volume and store that value in our bars Array
    bars.push(getAverageVolume(tempArray));

    // Render the bars
    renderBars(bars);
};

/**
 * Calculate the average value from the supplied array.
 *
 * @param {Array<Int>}
 */
const getAverageVolume = array => {    
    const length = array.length;
    let values = 0;
    let i = 0;

    // Loop over the values of the array, and count them
    for (; i < length; i++) {
        values += array[i];
    }

    // Return the avarag
    return values / length;
};

/**
 * Render the bars.
 */
const renderBars = () => {  
    if (!drawing) {
        drawing = true;

        window.requestAnimationFrame(() => {
            canvasContext.clearRect(0, 0, width, height);

            bars.forEach((bar, index) => {
                canvasContext.fillStyle = barColor;
                
                // Top part of the bar
                canvasContext.fillRect((index * (barWidth + barGutter)), (halfHeight - (halfHeight * (bar / 100))), barWidth, (halfHeight * (bar / 100)));

                // Bottom part of the bars
                canvasContext.fillRect((index * (barWidth + barGutter)), halfHeight, barWidth, (halfHeight * (bar / 100)));
            });

            drawing = false;
        });
    }
};



document.addEventListener('DOMContentLoaded', function () {
    list = document.getElementById('list');
    recordParts = document.getElementById('sec');
    recordFull = document.getElementById('record');
    request = document.getElementById('request');
    resume = document.getElementById('resume');
    pause = document.getElementById('pause');
    stop = document.getElementById('stop');
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
//    recordParts.addEventListener('click', startRecording.bind(null, 'parts'));
    recordFull.addEventListener('click', startRecording.bind(null, 'full'));
    request.addEventListener('click', requestData);
    resume.addEventListener('click', resumeRecording);
    pause.addEventListener('click', pauseRecording);
    stop.addEventListener('click', stopRecording);
//    recordParts.disabled = false;
    recordFull.disabled = false;
    
    
    // Get the canvas element and context
    canvas = document.querySelector('canvas');
    canvasContext = canvas.getContext('2d');

    // Set the dimensions
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    halfHeight = height / 1.5;

    // Set the size of the canvas context to the size of the canvas element
    canvasContext.canvas.width = width;
    canvasContext.canvas.height = height;
    
});

function startRecording(type) {
    list.innerHTML = '';
    navigator.mediaDevices.getUserMedia({audio: true}).then(function (stream) {
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
        
        // Create the audio nodes
        input = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        scriptProcessor = audioContext.createScriptProcessor();

        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 1024;

        // Connect the audio nodes
        input.connect(analyser);
        analyser.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        // Add an event handler
        scriptProcessor.onaudioprocess = processInput;

    });
    
    
//    recordParts.blur();
    recordFull.blur();
}

function stopRecording() {
    recorder.stop();
    recorder.stream.getTracks()[0].stop();
    stop.blur();
}

function pauseRecording() {
    recorder.pause();
    pause.blur();
}

function resumeRecording() {
    recorder.resume();
    resume.blur();
}

function requestData() {
    recorder.requestData();
    request.blur();
}

function saveRecord(e) {
    var li = document.createElement('li');
    var strong = document.createElement('strong');
    strong.innerText = 'dataavailable: ';
    li.appendChild(strong);
//    var s = document.createElement('span');
//    s.innerText = e.data.type +', ' + bytes(e.data.size, {unitSeparator: ' ', decimalPlaces: 0});
//    li.appendChild(s);
    var audio = document.createElement('audio');
    audio.controls = true;
    audio.src = URL.createObjectURL(e.data);
    li.appendChild(audio);
    list.appendChild(li);
}

function changeState(eventName) {
    var li = document.createElement('li');
    li.innerHTML = '<strong>' + eventName + ': </strong>' + recorder.state;
    if (eventName === 'start') {
        li.innerHTML += ', ' + recorder.mimeType;
    }
    list.appendChild(li);
    if (recorder.state === 'recording') {
//        recordParts.disabled = true;
        recordFull.disabled = true;
        request.disabled = false;
        resume.disabled = true;
        pause.disabled = false;
        stop.disabled = false;
    } else if (recorder.state === 'paused') {
//        recordParts.disabled = true;
        recordFull.disabled = true;
        request.disabled = false;
        resume.disabled = false;
        pause.disabled = true;
        stop.disabled = false;
    } else if (recorder.state === 'inactive') {
//        recordParts.disabled = false;
        recordFull.disabled = false;
        request.disabled = true;
        resume.disabled = true;
        pause.disabled = true;
        stop.disabled = true;
    }
}