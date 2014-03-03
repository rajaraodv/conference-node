/**
 * Module dependencies.
 */

var express = require('express'),
  http = require('http'),
  path = require('path');

var nforce = require('nforce');
var sfuser = process.env.SFUSER;
var sfpass = process.env.SFPASS;

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



var org = nforce.createConnection({
  clientId: '3MVG9A2kN3Bn17huxQ_nFw2X9Umavifq5f6sjQt_XT4g2rFwM_4AbkWwyIXEnH.hSsSd9.I._5Nam3LVtvCkJ',
  clientSecret: '1967801170401497065',
  redirectUri: 'http://localhost:3000/oauth/_callback',
  mode: 'single'
});

org.authenticate({
  username: sfuser,
  password: sfpass
}, function(err, res) {
  if (err) {
    return console.error('unable to authenticate to sfdc');
  }

  var query = 'SELECT Session__r.Track__c, Session__r.Id, Session__r.Name, Session__r.Description__c, Session__r.End_Date_And_Time__c,Session__r.Start_Date_And_Time__c, Session__r.session_duration__c, Session__r.location__c , Speaker__r.name, Speaker__r.Speaker_Bio__c, Speaker__r.photo_url__c, Speaker__r.Twitter__c, Speaker__r.Id, Name, Id FROM SessionSpeakerAssociation__c';

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
  console.dir(resultJSON);

  //append non speaking sessions like lunch breaks
  appendSessionsWithOutSpeakers();
}

// There may be sessions w/o speakers like lunch break (not technically sessions)
//Add those non speaker sessions to the same list so we can show it in the table
function appendSessionsWithOutSpeakers() {
  var query = 'SELECT Track__c, Id, Name, Description__c, End_Date_And_Time__c, Start_Date_And_Time__c, session_duration__c, location__c  FROM Session__c';

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
  return  {
    "Track__c": obj["Track__c"] || obj["track__c"],
    "Id": obj["Id"] || obj["id"],
    "Name": obj["Name"] || obj["name"],
    "Description__c": obj["Description__c"] || obj["description__c"],
    "End_Date_And_Time__c": obj["End_Date_And_Time__c"] || obj["end_date_and_time__c"],
    "Start_Date_And_Time__c": obj["Start_Date_And_Time__c"] || obj["start_date_and_time__c"],
    "Session_Duration__C": obj["session_duration__c"],
    "Location__c": obj["location__c"]
  }
}

function normalizeSpeakerObj(obj) {
  return  {
    "Name": obj["Name"] || obj["name"],
    "Id": obj["Id"] || obj["id"],
    "Speaker_Bio__c": obj["Speaker_Bio__c"] || obj["speaker_bio__c"],
    "Photo_Url__c": obj["Photo_Url__c"] || obj["photo_url__c"],
    "Twitter__c": obj["Twitter__c"] || obj["twitter__c"]
  }
}


http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});