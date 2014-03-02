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

  var query = 'SELECT Session__r.Track__c, Session__r.Id, Session__r.Name, Session__r.Description__c, Session__r.End_Date_And_Time__c,Session__r.Start_Date_And_Time__c, Session__r.location__c , Speaker__r.name, Speaker__r.Speaker_Bio__c, Speaker__r.photo_url__c, Speaker__r.Twitter__c, Speaker__r.Id, Name, Id FROM SessionSpeakerAssociation__c';

  org.query({
    query: query
  }, function(err, res) {
    if (err) {
      resultJSON = err;
      return console.error(err);
    }

    resultJSON = res;
    groupBySessions();
    //return console.dir(res);
  });

});

function groupBySessions() {
  var arr = new Array();
  var records = resultJSON.records;
  console.log("records.length " + records.length);
  for (var i = 0; i < records.length; i++) {
    var record = records[i].toJSON();
    var sessionId = record.session__r.Id;
    var session = arr[sessionId];
    if (session == "undefined" || session == undefined) {
      session = record.session__r;
      //create a new speakers array and push the first spearker
      session.speakers = [];
      session.speakers.push(record.speaker__r);

      //just add session__r that now also has speakers array
      arr[sessionId] = session;
    } else { //session already exists, just add speaker
      session.speakers.push(record.speaker__r);
    }
  }
  resultJSON = arr;
  console.dir(arr);
}

http.createServer(app).listen(app.get('port'), function() {
  console.log("Express server listening on port " + app.get('port'));
});