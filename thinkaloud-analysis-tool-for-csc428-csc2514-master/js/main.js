
var mAudio = null;
AmCharts.useUTC = true;
var mChart = null;
var audioDuration;
var note_array = [];
var participants_files = [];
var task_data;
var timeline_start, timeline_end;
var  pitchData = [], transcriptData = [];
var segmentPlayStart;
var logAudio = [];
var dataset;
//this variable is to mark whether the mouse select operation is executed so that it can be distinguished from click
var selection = false;
var selectedStart, selectedEnd;
// Get this from Azzy later.
var keywords = ['wondering',
  'what is',
  'how',
  'why',
  'could',
  'should'
];
var interestAreas = [];


window.onload = function(){
  Tipped.create('.legend-label')

  $('#gender').append("<option value='0'>" + 'Male' + "</option>");
  $('#gender').append("<option value='1'>" + 'Female' + "</option>");
  $("#gender").val("");

  $.get('./data/participant_file.json', function (files) {
    participants_files = files;
    participants = _.map(files,'id');
    _.each(participants, function(participant) {
      $('#participant_sel').append("<option value="+ participant +">" + participant + "</option>");
    });
    $("#participant_sel").val("");
  });

  $('#participant_sel').on('change', function() {
    $('#task_sel').empty();

    let participant = $('#participant_sel').val();
    let tasks = _.find(participants_files, {'id': parseInt(participant)}).tasks;
    _.each(tasks, function (task) {
      $('#task_sel').append("<option value="+ task.id +">" + task.id + "</option>");
    });
    $("#task_sel").val("");
  });

  $('#task_sel').on('change', function () {
    let participant = $('#participant_sel').val();
    let task = $('#task_sel').val();

    task_data = _.find(_.find(participants_files, {'id': parseInt(participant)}).tasks, {'id': parseInt(task)});
    loadTaskData(task_data);
  });

  $('#addNote').on('click', function () {
    let note = {}
    let start = $('#start').val().split(":");
    let end = $('#end').val().split(":");
    note.startTime = (parseInt(start[0])*60.) + parseFloat(start[1]);
    note.endTime = (parseInt(end[0])*60.) + parseFloat(end[1]);
    note.width = ((note.endTime - note.startTime)/audioDuration) * 100 + '%';
    note.start = (note.startTime/audioDuration) * 100 + '%';
    note.color = randomColor();
    note.annotation = $('#annotation').val();
    note.prob = $('#probDescription').val();
    let timestamp = new Date().valueOf();;
    note.id = timestamp;
    note_array.push(note);

    $('#notes_timeline').append("<span class='timeline-element note_" + note.id +"' style='"+
    "width:" + note.width +';left:' + note.start + ';background-color:' + note.color
    + "'></span>")

    $('#note-table').append(
      "<tr class=note_"+ note.id + "><td>" + note.startTime + '</td>' +
      "<td>" + note.endTime + '</td>' +
      "<td>" + note.prob + '</td>' +
      "<td>" + note.annotation + '</td>' +
      "<td><i class='fa fa-trash-o delete-note' aria-hidden='true'></i></tr>"
    )

    $('.note_' + note.id + '> td > i').on('click', function() {
      $('.note_' + note.id).remove();
      _.remove(note_array, function (n) {
        return n.id == note.id;
      });
    });

    $('span.note_' + note.id).mouseover(function() {
      $('tr.note_' + note.id).css({'background-color': 'yellow'});
    });

    $('span.note_' + note.id).mouseout(function() {
      $('tr.note_' + note.id).css({'background-color': ''});
    });

    $('#start').val("");
    $('#end').val("");
    $('#annotation').val("");
    $('#probDescription').val("");
  });

  $('.timeline-outline').mousemove(function (ev) {
    updateOnMouseMove(ev);
  });

  $('#confirmFiles').on('click', function (ev) {
    // ev.preventDefault();
    $('.participant-selection').addClass('hidden');
  });
  $.key('ctrl+shift+s', function() {
    let audioLog = JSON.stringify(logAudio);
    let jsonData = JSON.stringify(note_array);

    let participant = $('#participant_sel').val();
    let task = $('#task_sel').val();

    let filename = 'uxproblem_' + participant + '_' + task + '_' + Date.now() + '.json'
    let audioFile = 'audioLog_' + participant + '_' + task + '_' + Date.now() + '.json'

    download(jsonData, filename, 'text/plain');
    //download(audioLog, audioFile, 'text/plain');
  });

  setTranscriptSelectionEventListener();
};

function updateOnMouseMove(event) {
  let width = $("#notes_timeline").width();
  let x_pos = event.pageX - $("#notes_timeline").parent().offset().left;

  let time = ((x_pos/width) * (timeline_end - timeline_start) + timeline_start) * 1000;

  updateTranscript(time);
  drawTimeIndicator(time);
  var currentDate = new Date(Math.floor(time));
  if(mChart != null){
    mChart.panels[0].chartCursor.showCursorAt(currentDate);
  }
};

function download(text, name, type) {
    var a = document.createElement("a");
    var file = new Blob([text], {type: type});
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
}

function loadTaskData () {  //load the audio when the UI is displayed
  mAudio = document.getElementById("audiocontrol");
  mAudio.src = task_data.audio;
  mAudio.addEventListener('loadedmetadata', processAudio);
  mAudio.addEventListener('play', recordStart);
  mAudio.addEventListener('pause', recordEnd);
  //check audio's loading status. if it is not ready, load it again
  if (mAudio.readyState >= 2) {
    processAudio();
  }

  [transcriptData, pitchData] = parseData(task_data.data);

  setTimeout(myTimer, 500);
  function myTimer() {
    if(pitchData.length != 0 && transcriptData.length != 0)
    {
      console.log("data is ready...");
      console.log(pitchData.length);
      mChart = drawCharts();
      drawTranscript();
    }
    else {
      setTimeout(myTimer, 500);
    }
  }
};

function recordStart(){
  segmentPlayStart= mAudio.currentTime;
}

function recordEnd() {
  let segment = [segmentPlayStart, mAudio.currentTime];
  logAudio.push(segment);
}

function processAudio() {
  audioDuration = mAudio.duration;
  //console.log(mAudio.duration);
  timeline_start = 0;
  timeline_end = audioDuration;
}

function parseData(dataset_url) {
  var transcriptData = [];
  var pitchData = [];
  AmCharts.loadFile(dataset_url, {}, function(data) {
    inputdata = AmCharts.parseJSON(data);
    dataset = inputdata;
    for(var i = 0; i < inputdata.length; i++){
      var start = parseInt(parseFloat(inputdata[i].start_time) * 1000);
      var end = parseInt(parseFloat(inputdata[i].end_time) * 1000);
      var value = inputdata[i].transcription;
      var numWords = value.split(" ").length;
      //console.log("numWords: " + numWords);
      transcriptData.push({"start": start, "end": end, "label": String(value).trim()});

      var temppitchData = inputdata[i].pitch;
      for(var j = 0; j < temppitchData.length; j++){
        var time = start + j * (end - start) / temppitchData.length;
        pitchData.push({"time": time, "data":parseFloat(temppitchData[j]),"legendColor": AmCharts.randomColor, "label": "undefined"});
      }

    }});
  return [transcriptData, pitchData];
}

//draw a line graph of the feature (e.g., pitch)
function drawCharts(){
  var chart = null;
  chart = AmCharts.makeChart("chartdiv", {
    type: "stock",
    "theme": "light",
    dataSets: [
  {
    fieldMappings: [{
      fromField: "data",
      toField: "data2"
    },
    {
      fromField: "label",
      toField: "label2"
    },
    {
      fromField: "legendColor",
      toField: "legendColor"
    }
  ],
  dataProvider: pitchData,
  categoryField: "time",
  compared: false
}
],
panels: [
{
  showCategoryAxis: true,
  title: "Pitch (HZ)",
  allowTurningOff: false,
  stockGraphs: [ {
    id: "g2",
    compareGraphType:"smoothedLine",
    valueField: "data2",
    compareField: "data2",
    comparable: false,
    visibleInLegend: true,
    showBalloon: false,
    lineColorField: "lineColor",
  } ],
  stockLegend: {
    enabled: true,
    markType: "none",
    markSize: 0
  },
  listeners:[
  {
    event: "zoomed",
    method: handleZoom
  },{
    event: "changed",
    method: handleMousemove,
  }],
}
],
valueAxesSettings:{
  labelsEnabled: false,
},
categoryAxesSettings: {
  groupToPeriods: [ 'fff', 'ss' ], // specify period grouping
  parseDates: true,
  autoGridCount: false,
  dateFormats: [{
    period: "fff",
    format: "JJ:NN:SS"
  }, {
    period: "ss",
    format: "JJ:NN:SS"
  }, {
    period: "mm",
    format: "JJ:NN:SS"
  }, {
    period: "hh",
    format: "JJ:NN:SS"
  }, {
    period: "DD",
    format: "MMM DD"
  }, {
    period: "WW",
    format: "MMM DD"
  }, {
    period: "MM",
    format: "MMM"
  }, {
    period: "YYYY",
    format: "YYYY"
  }],
  //"equalSpacing": true,
  minPeriod: "fff"
},
chartScrollbarSettings: {
  enabled: true,
  graph: "g1",
  usePeriod: "fff",
  position: "top",
  dragIcon: "dragIconRectSmall",
  selectedGraphLineColor:"#888888",
},
chartCursor:{
  categoryBalloonDateFormat: "JJ:NN:SS",
},
chartCursorSettings: {
  valueBalloonsEnabled: true,
  fullWidth:false,
  cursorAlpha:0.6,
  selectWithoutZooming: true
},
legend:{
  enabled:false
}
,
periodSelector: {
  labelStyle: 'hidden',
  position: "top",
  dateFormat: "JJ:NN:SS", // date format with milliseconds "NN:SS:QQQ"
  inputFieldsEnabled: false,
  inputFieldWidth: 100,
  periods: [{
    period: "MAX",
    label: "Show all",
    selected: true
  } ]
}
});
return chart;
}
function drawTranscript(){
  // three data fields: start, end, label
  var transcript = "";
  for(var i in transcriptData){
    var value = transcriptData[i].label;
    transcript += String(value).trim() + "<br/>";
  }
  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;
}

//this function is to get the selected text and past it into the analysis note textarea as a quote.
function setTranscriptSelectionEventListener()
{
  var transcript = document.getElementById('transcriptdiv');
  transcript.addEventListener('mouseup', transcriptMouseupHandler, false);
}

//handle selection events on the transcript view
function transcriptMouseupHandler(){
  var startTime = -1;
  var endTime = -1;
  var selectedtext = [];
  if (window.getSelection) {
      selectedtext = window.getSelection().toString().split("\n");
      //console.log("# sents selected: " + selectedtext.length);
      if(selectedtext.length > 1){
        var startsentence = selectedtext[0];
        var endsentence = selectedtext[selectedtext.length-1];
        //console.log("startsentence: " + startsentence);
        for(var j = 0; j < transcriptData.length - selectedtext.length; j++){
          var value = transcriptData[j].label.toString().trim();
          var endvalue = transcriptData[j+selectedtext.length-1].label.toString().trim();
          if((value == startsentence || value.includes(startsentence)) && (endvalue == endsentence || endvalue.includes(endsentence))){
            startTime = parseFloat(transcriptData[j].start);
            var endindex = j+selectedtext.length+1 > transcriptData.length -1 ? transcriptData.length -1: j+selectedtext.length+1;
            endTime = parseFloat(transcriptData[endindex].start);
            //console.log("start: " + startTime + "; end: " + endTime);
            break;
          }
        }
      }
      else if (selectedtext.length == 1){
        var startsentence = selectedtext[0];
        for(var j = 0; j < transcriptData.length; j++){
          var value = transcriptData[j].label.toString().trim();
          if(value == startsentence){
            startTime = parseFloat(transcriptData[j].start);
            endTime = parseFloat(transcriptData[j+1].start);
            //console.log("start: " + startTime + "; end: " + endTime);
            break;
          }
        }
      }

      if(startTime >= 0){
        var startInSecs = parseInt(startTime/1000);
        var endInSecs = parseInt(endTime/1000);
        var startMins = parseInt(startInSecs / 60);
        var startSecs = startInSecs - startMins * 60;
        var endMins = parseInt(endInSecs / 60);
        var endSecs = endInSecs - endMins * 60;
        document.getElementById("start").value = startMins + ":" + startSecs; //convert the miliseconds into seconds
        document.getElementById("end").value = endMins + ":" + endSecs; //convert the miliseconds into seconds

        mAudio.currentTime = startInSecs; //convert the miliseconds into seconds
        mAudio.pause();
        mChart.validateData();
        var currentDate = new Date(Math.floor(startTime));
        mChart.panels[0].chartCursor.showCursorAt(currentDate);
        drawTimeIndicator(currentDate);
        updateTranscriptOnSelection(startInSecs,endInSecs);
        highlightNoteTimeline(startInSecs,endInSecs);
      }
  }
}

//handle mousemove event on the line graph
//synchronize the mouse cursor with the transcript
function handleMousemove(e){
  //console.log(e.chart.chartCursor.timestamp);
  var timestamp = parseFloat(e.chart.chartCursor.timestamp);
  //console.log("handleMousemove");
  if(selection == false)
    updateTranscript(timestamp);
  drawTimeIndicator(timestamp);
}

function drawTimeIndicator(timestamp) {
  //console.log("timestamp: "+ timestamp);
  let time = timestamp/1000;
  let total_duration = timeline_end - timeline_start;
  let start = ((time - timeline_start)/total_duration) * 100;

  $('.timeline-indicator').remove();

  if (start < 100 && start > 0) {
    start = start + '%'
    $('#notes_timeline').append("<span class='timeline-element timeline-indicator' style='"+
    "width:0%" +';left:' + start + "'></span>")
  }

}

//highlight the corresponding segment in the note  timeline when a portion of the transcript is selected
function highlightNoteTimeline(startTime,endTime){
  $('#notes_timeline').empty();
  let duration = timeline_end - timeline_start;
  _.each(note_array, function (label) {
    //console.log("label.start:" + label.startTime + "; timeline_end :" + timeline_end);
    let end = ((label.endTime - timeline_start)/duration) * 100;
    let start = ((label.startTime - timeline_start)/duration) * 100;
    if (Math.max(start, 0) < Math.min(100, end)) {
      start = Math.max(0, start);
      let width = Math.min(100, end) - start;
      label.start = start + '%';
      label.width = width + '%';
      $('#notes_timeline').append("<span class='timeline-element' style='"+
      "width:" + label.width +';left:' + label.start + ';background-color:' + label.color
      + "' title="+ label.annotation+" value=" + label.startTime + "></span>")
    }
  });

  //hight the mouse selected portion's backgroud color
  let end = ((endTime - timeline_start)/duration) * 100;
  let start = ((startTime - timeline_start)/duration) * 100;
  if (Math.max(start, 0) < Math.min(100, end)) {
    start = Math.max(0, start);
    let width = Math.min(100, end) - start;
    highlightStart = start + '%';
    hightWidth = width + '%';
    $('#notes_timeline').append("<span class='timeline-element' style='"+
    "width:" + hightWidth +';left:' + highlightStart + '; height: 600px' + ';background-color: #B0B0B0; opacity: 0.6'
    + "'></span>")
  }
}

//this function is to sync the transcript with the feature graph when the mouse moves over the graph
function updateTranscript(currentTimeInMS){
  var transcript = "";
  for(var i in transcriptData){
    var value = transcriptData[i].label;
    var start = parseFloat(transcriptData[i].start);
    var end = parseFloat(transcriptData[i].end);

    //console.log("timestamp: " + e.chart.chartCursor.timestamp + " , start: " + start + ", end: " + end + " , word: " + value);
    if (currentTimeInMS >= start && currentTimeInMS <= end)
    {
      transcript += "<span class='transcript-line highlight'>" + String(value).trim() + "<br/>" + "</span>";
    }
    else {
      transcript += "<span class='transcript-line'>" + String(value).trim() + "<br/>" + "</span>";
    }
  }

  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;

  let previousLines = $('.highlight').prevAll('.transcript-line')
  //
  if (previousLines.length > 20) {
    previousLines.get(20).scrollIntoView();
  }
}

//this function is to highlight the corresponding part in the transcript when a portion of the graph is selected
function updateTranscriptOnSelection(startTime, endTime){
  //console.log("update: " + startTime + "; end: " + endTime);``
  var transcript = "";
  for(var i = 0; i < transcriptData.length-1; i++){
    var value = transcriptData[i].label;
    var start = parseFloat(transcriptData[i].start);
    var end = parseFloat(transcriptData[i+1].start);

    //console.log("timestamp: " + e.chart.chartCursor.timestamp + " , start: " + start + ", end: " + end + " , word: " + value);
    if (start >= parseFloat(startTime) * 1000 && end <= parseFloat(endTime) * 1000)
    {
      //console.log("transcript: " + start + "; end: " + end);
      transcript += "<span class='transcript-line highlight'>" + String(value).trim() + "<br/>" + "</span>";
    }
    else {
      transcript += "<span class='transcript-line'>" + String(value).trim() + "<br/>" + "</span>";
    }
  }

  var x = document.getElementById("transcriptdiv");
  x.innerHTML = transcript;

  let previousLines = $('.highlight').first().prevAll('.transcript-line')
}

function handleZoom(event) {
  timeline_start = moment.duration(event.startValue).asMilliseconds() / 1000.0;
  timeline_end = moment.duration(event.endValue).asMilliseconds() / 1000.0;
}

setTimeout(myTimer2, 500);

function myTimer2() {
  if(mChart != null && mAudio != null)
  {
    //console.log("charts and the audio control are both ready...");
    connectAudioCharts();
    connectMouseEvents();
  }
  else {
    setTimeout(myTimer2, 500);
  }
}

function connectAudioCharts(){
  mAudio.addEventListener("timeupdate", function(e) {
    //console.log("time: " + e.target.currentTime);
    var currentDate = new Date(Math.floor(e.target.currentTime * 1000));
    for(var x in mChart.panels){
      //console.log("set panel  " + x);
      mChart.panels[x].chartCursor.showCursorAt(currentDate);
    }
  });
}

function connectMouseEvents(){
  //console.log("connecting mouse events... ");
  for(var x in mChart.panels){
    //console.log("set panel  " + x);
    mChart.panels[x].chartCursor.addListener("changed", AmCharts.myHandleMove);
    mChart.panels[x].chartDiv.addEventListener("mousedown", AmCharts.myHandleClick);
    mChart.panels[x].chartCursor.addListener("selected", handleSelection);
  }
}

AmCharts.myHandleMove = function(event) {
  if (undefined === event.index )
    return;
  AmCharts.myCurrentPosition = event.chart.dataProvider[event.index].time;
}

AmCharts.myHandleClick = function(event){
  if(selection === false)
  {
    //console.log("clicked");
    for(var x in mChart.panels){
      //console.log("time: " + AmCharts.myCurrentPosition.getTime());
      mAudio.currentTime = AmCharts.myCurrentPosition.getTime()/1000; //convert the miliseconds into seconds
      mAudio.pause();
    }
  }
  else {
    selection = false;
  }
  $('.backhigh').remove();
}

// mouse selection event handler for the feature graph
function handleSelection(event){
  //console.log("selected");
  selection = true;
  //console.log("event.start: " + event.start);
  //console.log("event.end: " + event.end);
  var startInSecs = parseFloat(event.start/1000);
  var endInSecs = parseFloat((event.end+1)/1000);
  var startMins = parseInt(startInSecs / 60);
  var startSecs = startInSecs - startMins * 60;

  var endMins = parseInt(endInSecs / 60);
  var endSecs = endInSecs - endMins * 60;

  document.getElementById("start").value = startMins + ":" + startSecs; //convert the miliseconds into seconds
  document.getElementById("end").value = endMins + ":" + endSecs; //convert the miliseconds into seconds

  updateTranscriptOnSelection(startInSecs,endInSecs);

  mAudio.currentTime = startInSecs; //convert the miliseconds into seconds
  mAudio.pause();
  //console.log("startInSecs: " + startInSecs);
  drawTimeIndicator(startInSecs);
  highlightNoteTimeline(startInSecs,endInSecs);
  mChart.validateData();
}

// handle keyboard press event
document.addEventListener('keydown', function(e) {
  //press ESC to start/pause audo play
  if(e.keyCode == 27){
    if(mAudio != null && mAudio.paused){
      mAudio.play();
    }
    else if(mAudio != null && !mAudio.paused){
      mAudio.pause();
    }
  }
});


$('#prepopulated').on('click', function () {
    $('#prepopulated').addClass('active');
    $('#final').removeClass('active');
    $('.note-table').hide();
    $('.prepopulated-table').show();
    $('#timeLine').hide();
    $('#addNote').hide();
});

$('#final').on('click', function () {
    $('#final').addClass('active');
    $('#prepopulated').removeClass('active');
    $('.note-table').show();
    $('.prepopulated-table').hide();
    $('#timeLine').show();
    $('#addNote').show();
});
$('#populateProblems').on('click', function (ev) {

    if(pitchData.length != 0 && transcriptData.length != 0)
    {
      console.log("data is ready...");
      console.log(pitchData);
      console.log(pitchData.length);
      sampleData = pitchAnalyze();
      startTime = sampleData[0].time;
      endTime = sampleData[1].time;
      percentage = sampleData[2];
      id = uuidv4();
      $('#prepopulated-table').append(
            "<tr class=note_"+ id + "><td>" + startTime + '</td>' +
            "<td>" + endTime + '</td>' +
            "<td>" + percentage + '</td>' +
            "<td><i class='fa fa-plus' aria-hidden='true'></i></tr>"
    )
    $('.note_' + id + '> td > i').on('click', function() {
      new_id = uuidv4();
      annotation = $('#annotation').val();
      prob = $('#probDescription').val();
      $('#note-table').append(
      "<tr class=note_"+ new_id + "><td>" + startTime + '</td>' +
      "<td>" + endTime + '</td>' +
      "<td>" + prob + '</td>' +
      "<td>" + annotation + '</td>' +
      "<td><i class='fa fa-trash-o delete-note' aria-hidden='true'></i></tr>"
    )
    var_note = {endTime:endTime,annotation:annotation,startTime:startTime,prob:prob,id:new_id};
    note_array.push(var_note);
    $('.note_' + new_id + '> td > i').on('click', function() {
      $('.note_' + new_id).remove();
      _.remove(note_array, function (n) {
        return n.id == new_id;
      });
    });
    $('.note_' + id).remove();
    $('#annotation').val("");
    $('#probDescription').val("");
    });
    }
    else {
      setTimeout(myTimer, 500);
    }
});


//This function has to be implemented that it will return all the period which has potental problems with percentage.
//now it is filled with sample data
//Also note that time has to be converted into mm:ss format
function pitchAnalyze(){
    let tindex;
    let kindex;
    for (tindex = 0; tindex < transcriptData.length; tindex++) {
        let transcript = transcriptData[tindex];
        for (kindex = 0; kindex < keywords.length; kindex++) {
          let keyword = keywords[kindex];
          if (transcript.label.toLowerCase().indexOf(keyword) !== -1) {
            interestAreas.push(transcript);
            break;
          }
        }
    }

    pitchAreas = {};
    for (var index in dataset) {
      var data = dataset[index];
      var start = parseInt(parseFloat(data.start_time) * 1000);
      var end = parseInt(parseFloat(data.end_time) * 1000);
      var s_trans = interestAreas.filter( function(item) {return (item.start == start);} );
      if (s_trans.length > 0) {
          var label = s_trans[0].label;
          pitchAreas[label] = [];
          var temppitchData = data.pitch;
          var startTime = start + 0 * (end - start) / temppitchData.length;
          var endTime = start + (temppitchData.length - 1) * (end - start) / temppitchData.length;
          var pitchStartIndex = pitchData.indexOf(pitchData.filter( function(item){return (item.time==startTime);} )[0]);
          var pitchEndIndex = pitchData.indexOf(pitchData.filter( function(item){return (item.time==endTime);} )[0]);
          pitchAreas[label].push([pitchStartIndex, pitchEndIndex]);
      }
    }

    var keys = Object.keys(pitchAreas);
    for (var key in keys) {
        var message = keys[key];
        if (!pitchInterestArea(pitchAreas[message][0], pitchAreas[message][1])) {
            delete pitchAreas.message;
        }
    }
    return pitchAreas
}

function pitchInterestArea(start_index, end_index) {
    let potential_problems = [];
    let gender = $('#gender').val()
    let min = gender ? 165 : 85;
    let max = gender ? 255 : 180;

    let i;
    for (i = start_index; i <= end_index; i++) {
        if (pitchData[i].data <= min || pitchData[i].data >= max) {
          return true;
        }
    }
    return false;
}

//random id generator
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
