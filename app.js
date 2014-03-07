/**
 * Module dependencies.
 */

var express = require('express'),
  http = require('http'),
  path = require('path');

var nforce = require('nforce');
var SFUSER = process.env.SFUSER;
var SFPASS = process.env.SFPASS;
var GI_CLIENT_ID = process.env.GI_CLIENT_ID;
var GI_CLIENT_SECRET = process.env.GI_CLIENT_SECRET;
var SF_CLIENT_ID = process.env.SF_CLIENT_ID;
var SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET;

if (!SFUSER || !SFPASS || !GI_CLIENT_ID || !GI_CLIENT_SECRET || !SF_CLIENT_ID || !SF_CLIENT_SECRET) {
  console.log("\n******Environment variable missing***");
  console.log("SFUSER = " + SFUSER +
    "\nSFPASS = " + SFPASS +
    "\nGI_CLIENT_ID = " + GI_CLIENT_ID +
    "\nGI_CLIENT_SECRET = " + GI_CLIENT_SECRET +
    "\nSF_CLIENT_ID = " + SF_CLIENT_ID +
    "\nSF_CLIENT_SECRET = " + SF_CLIENT_SECRET + "\n ");

  return;
}
var GoInstant = require('goinstant-rest').v1;

var client = new GoInstant({
  client_id: GI_CLIENT_ID,
  client_secret: GI_CLIENT_SECRET
});

// client.apps.rooms.all({
//   app_id: 2608
// }, function(err, rooms, res) { 

//   console.dir(rooms);
// });

var opts = {
  app_id: 2608,
  room_id: 73223,
  channel: 'conferenceChannel',
  value: 'myval'
};

client.channels.message(opts, function(err, value) {
  console.dir(value);
});



var app = express();

app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
});


app.configure('development', function() {
  app.use(express.errorHandler());
});

var resultJSON = {};
app.get('/', function(req, res) {
  return res.json(resultJSON);
});

app.post('/feedback', function(req, res) {
  var body = req.body;
  console.dir(body);
  var feedback = nforce.createSObject('Feedback__c');

  feedback.set('Session__c', body.Session__c);
  feedback.set('Rating__c', body.Rating__c);
  feedback.set('Text__c', body.Text__c);
  feedback.set('Anonymous_App_Id__c', body.Anonymous_App_Id__c);
  org.insert({
    sobject: feedback,
    oauth: oauth
  }, function(err, resp) {
    var result = err || resp;
    var statusCode = result.statusCode;
    if(!statusCode || statusCode == undefined) {
      statusCode = 200;
    }
    console.log("*** statusCode " +  statusCode);
    res.json(statusCode, result);
  });
});


var org = nforce.createConnection({
  //clientId: '3MVG9A2kN3Bn17huxQ_nFw2X9Umavifq5f6sjQt_XT4g2rFwM_4AbkWwyIXEnH.hSsSd9.I._5Nam3LVtvCkJ',
  //clientSecret: '1967801170401497065',
  clientId: SF_CLIENT_ID,
  clientSecret: SF_CLIENT_SECRET,
  redirectUri: 'http://localhost:3000/oauth/_callback',
  mode: 'single'
});

var oauth; // store after connection

function downloadDataFromSalesforce() {
  org.authenticate({
    username: SFUSER,
    password: SFPASS
  }, function(err, oauth) {
    if (err) {
      return console.error('unable to authenticate to sfdc');
    }
    console.log('Connected to Salesforce');


    //subscribe to push topics
    subscribeToAllPushTopics(oauth);

    var query = 'SELECT Session__r.Title__c, Session__r.Track__c, Session__r.Id, Session__r.Name, Session__r.Description__c, Session__r.End_Date_And_Time__c,Session__r.Start_Date_And_Time__c, Session__r.session_duration__c, Session__r.location__c , Session__r.Background_Image_Url__c, Speaker__r.name, Speaker__r.title__c, Speaker__r.Speaker_Bio__c, Speaker__r.photo_url__c, Speaker__r.Twitter__c, Speaker__r.Id, Name, Id FROM SessionSpeakerAssociation__c';
    org.query({
      query: query
    }, function(err, res) {
      if (err) {
        resultJSON = err;
        return console.error(err);
      }

      resultJSON = res;
      groupBySessions();
    });

  });
};


// Subscribe to 2 push topics to listen to changes
//Note we can't create pushTopics on relationships, that why we are creating push topics for each object
function subscribeToAllPushTopics(oauth) {
  subscribeToPushTopics(oauth, 'SessionsTopic'); //session changes
  subscribeToPushTopics(oauth, 'SpeakersTopic3'); //speaker changes
  console.log('Subscribed to Push Topics');
}

function subscribeToPushTopics(oauth, topicName) {
  // subscribe to a pushtopic
  var sessionsPT = org.stream({
    topic: topicName,
    oauth: oauth
  });

  sessionsPT.on('connect', function() {
    console.log('connected to ' + topicName + ' pushtopic');
  });

  sessionsPT.on('error', function(error) {
    console.log('error: ' + error);
  });

  sessionsPT.on('data', function(data) {
    console.log(data);
  });
}

function groupBySessions() {
  var sessionsObj = {};
  var records = resultJSON.records;
  for (var i = 0; i < records.length; i++) {
    var record = records[i].toJSON();
    record.session__r = normalizeSessionObj(record.session__r);
    //console.dir(record.session__r);
    var sessionId = record.session__r.Id;
    var session = sessionsObj[sessionId];
    if (session == "undefined" || session == undefined) {
      session = record.session__r;
      //create a new speakers array and push the first spearker
      session.speakers = [];
      session.speakers.push(normalizeSpeakerObj(record.speaker__r));

      //just add session__r that now also has speakers array
      sessionsObj[sessionId] = session;
    } else { //session already exists, just add speaker
      session.speakers.push(normalizeSpeakerObj(record.speaker__r));
    }
  }

  //set to resultJSON
  resultJSON = sessionsObj;
  console.log("Got Sessions JSON data from Salesforce");

  //append non speaking sessions like lunch breaks
  appendSessionsWithOutSpeakers();
}

// There may be sessions w/o speakers like lunch break (not technically sessions)
//Add those non speaker sessions to the same list so we can show it in the table
function appendSessionsWithOutSpeakers() {
  var query = 'SELECT Title__c, Track__c, Id, Name, Description__c, End_Date_And_Time__c, Start_Date_And_Time__c, session_duration__c, location__c, Background_Image_Url__c  FROM Session__c';

  org.query({
    query: query
  }, function(err, res) {
    if (err) {
      resultJSON = err;
      return console.error(err);
    }
    var records = res.records;
    for (var i = 0; i < records.length; i++) {
      //console.dir(record);

      var record = records[i].toJSON();
      record = normalizeSessionObj(record);
      var sessionId = record.Id;

      //check if the session already exists in resultJSON, if not add it
      var session = resultJSON[sessionId];
      if (session == "undefined" || session == undefined) {
        resultJSON[sessionId] = record;
      }
    }

  });
}

function normalizeSessionObj(obj) {
  return {
    "Title__c": obj["Title__c"] || obj["title__c"],
    "Track__c": obj["Track__c"] || obj["track__c"],
    "Id": obj["Id"] || obj["id"],
    "Name": obj["Name"] || obj["name"],
    "Description__c": obj["Description__c"] || obj["description__c"],
    "End_Date_And_Time__c": obj["End_Date_And_Time__c"] || obj["end_date_and_time__c"],
    "Start_Date_And_Time__c": obj["Start_Date_And_Time__c"] || obj["start_date_and_time__c"],
    "Session_Duration__C": obj["Session_Duration__c"] || obj["session_duration__c"],
    "Location__c": obj["Location__c"] || obj["location__c"],
    "Background_Image_Url__c": obj["Background_Image_Url__c"] || obj["background_image_url__c"]
  }
}

function normalizeSpeakerObj(obj) {
  return {
    "Name": obj["Name"] || obj["name"],
    "Id": obj["Id"] || obj["id"],
    "Speaker_Bio__c": obj["Speaker_Bio__c"] || obj["speaker_bio__c"],
    "Photo_Url__c": obj["Photo_Url__c"] || obj["photo_url__c"],
    "Twitter__c": obj["Twitter__c"] || obj["twitter__c"],
    "Title__c": obj["Title__c"] || obj["title__c"]
  }
}


http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
  //download at the beginning
  downloadDataFromSalesforce();
});