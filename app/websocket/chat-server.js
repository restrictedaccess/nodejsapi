#!/usr/bin/env node
var WebSocketServer = require('websocket').server;
var http = require('http');
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');

var notificationsSchema = require("../models/Notifications");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
 
var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});
 
wsServer = new WebSocketServer({
    httpServer: server,
    
    autoAcceptConnections: false
});
 
function originIsAllowed(origin) {
  return true;
}


var keys=[];
 
wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    var connection = request.accept('echo-protocol', request.origin);
    
    var key = "";
    var app = "";

    var zmq = require('zmq')
    , sock = zmq.socket('pull');
  
    sock.connect('tcp://127.0.0.1:3200');
    console.log('Worker connected to port 3000');

    sock.on('message', function(msg){
    	var message = JSON.parse(msg.toString());    	
        console.log("doc_id : "+message._id);
        
        
        if(keys.indexOf(message.key) == -1){
        	//Not found. Recipient is offline        	
        	console.log("Recipient is offline : " + message.key);
        	console.log("doc_id : "+message._id);
        	var received=false;
        	var date_received = null;
        	
        }else{
        	//Recipient found. Online
        	var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			
        	if (typeof message.key !="undefined" && message.key==key && typeof message.app != "undefined" && message.app == app){
	            console.log("Current Session recipient : "+message.key);
	            console.log("doc_id : "+message._id);
	            var received=true;
	            var date_received = atz.toDate()
	            connection.sendUTF(msg.toString());
	        }	
        }
        
       	
        
        
        //Update the mongodb document
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
		var Notifications = db.model("Notifications", notificationsSchema);	
		var search_key={"_id" : message._id};
		
		db.once('open', function(){
 			Notifications.findOne(search_key).exec(function(err, doc){
				if(err){
					db.close();
			    	console.log(err);
				}
				
				doc.received = received;
				doc.date_received = date_received;								
				doc.save(function(err, updated_doc){
					if(!err){
						console.log("updated doc " + doc._id);
						db.close();						
					}										
				});
				
			});
			
 		});

    });   
    
     
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            var data = JSON.parse(message.utf8Data);
            if (typeof data.key != "undefined"){
                key = data.key; 
                keys.push(key);   
            }
            if (typeof data.app != "undefined"){
                app = data.app;    
            }
            //console.log("key => " + key);
            //console.log("app => " + app);
            //connection.sendUTF(message.utf8Data);
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            //connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});