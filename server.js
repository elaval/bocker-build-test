 
var mosca = require('mosca');
var mongoose    = require('mongoose');
var jwt    = require('jsonwebtoken'); // used to create, sign, and verify tokens
var request = require('request-json');
var Q = require('q');
var User   = require('./app/models/user'); // get our mongoose model
var Device   = require('./app/models/device'); // get our mongoose model
var config = require('./config'); // get our config file
var express     = require('express');
var app         = express();

var apiClient = request.createClient('http://localhost:8080/');
 
mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable


var ascoltatore = {
  //using ascoltatore
  type: 'mongo',
  url: 'mongodb://184.72.79.8:27017/mqtt',
  pubsubCollection: 'ascoltatori',
  mongo: {}
};

var settings = {
  port: 1883,
  backend: ascoltatore
};

// Accepts the connection if the username and password are valid
var authenticate = function(client, username, password, callback) {

  if (username === 'jwt') {
    var token = password.toString();
    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {      
      if (err) {
        var authorized = false;

      } else {
        var authorized = true;
        client.user = decoded;
        client.token = token;
      }
      callback(null, authorized); 
    });
  } else {
    var authorized = (username === 'ernesto' && password.toString() === 'clave');
    if (authorized) client.user = username;


    callback(null, authorized);    
  }

}

// In this case the client authorized as alice can publish to /users/alice taking
// the username from the topic and verifing it is the same of the authorized user
var authorizePublish = function(client, topic, payload, callback) {

  var topicList = topic.split('/');

  var topic_1 = topicList.length >=1 ? topicList[0] : null;
  var topic_2 = topicList.length >=2 ? topicList[1] : null;
  var name = client.user.username;

  // Check if the first topic is the udername
  if (topic_1 !== name) {

    callback(null,false);
  } else {
    validDevice(client.token,topic_2)
    .then(function() {
      callback(null, true);
    })
    .catch(function() {
      callback(null, false);
    })
  }

}

function validDevice(token, deviceName) {
  var deferred = Q.defer();

  // Check if the device name is valid for this user
  apiClient.get('api/devices/'+deviceName+'?token='+ token, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      // We found a device with this name for the user
      if (body.deviceName == deviceName) {
        deferred.resolve(true);
      } else {
        deferred.reject("Non existent device for this user");
      }

    } else {
      console.log(error, response.statusCode);
      console.log(body);
      deferred.reject(body.message || "Not Found");
    }
  })

  return deferred.promise;
}




// In this case the client authorized as alice can subscribe to /users/alice taking
// the username from the topic and verifing it is the same of the authorized user
var authorizeSubscribe = function(client, topic, callback) {

  //callback(null, client.user == topic.split('/')[1]);
  callback(null, true);
}

var server = new mosca.Server(settings);

server.on('clientConnected', function(client) {
    console.log('client connected', client.id);
});

// fired when a message is received
server.on('published', function(packet, client) {
  console.log('Published', packet.payload);
});

server.on('ready', setup);

function setup() {
  server.authenticate = authenticate;
  server.authorizePublish = authorizePublish;
  server.authorizeSubscribe = authorizeSubscribe;
  console.log('Mosca server is up and running');
}

