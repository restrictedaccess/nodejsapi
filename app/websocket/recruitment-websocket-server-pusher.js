#!/usr/bin/env node
var zmq = require('zmq')
  , socket = zmq.socket('push');

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


function logToConsole (message) {  
    console.log("[" + new Date().toLocaleTimeString() + "] " + message);
}

function sendMessage (doc) {  
    logToConsole("Sending: " + JSON.stringify(doc));
    
    var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var date_sent = atz.toDate();
	
	doc.sent=true;
	doc.date_sent = date_sent;
	//console.log(doc);
	doc.save(function(err, updated_doc){
		if(!err){
			//console.log("updated doc " + doc._id);
			socket.send(JSON.stringify(updated_doc));			
			willFulfillDeferred.resolve(updated_doc);
		}	
						
	});
	
    return willFulfill;
    
}
var counter = 0;

var received_counter = 0;
socket.bind("tcp://127.0.0.1:3200", function (error) {
    if (error) {
        logToConsole("Failed to bind socket: " + error.message);
        process.exit(0);
    }
    else {
        logToConsole("Server listening on port 3200");
		
		
 		
		setInterval(function () { 
			try{
				var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
	 			var Notifications = db.model("Notifications", notificationsSchema);	
	 			// var search_key={"sent" : false};

                var search_key = {$or:[
                    {
                        'sent':false
                    },
                    {
                        'sent': {
                            $exists: false
                        }
                    }
                ]};
	 			
				db.once('open', function(){
		 			Notifications.find(search_key).exec(function(err, docs){
						if(err){
							console.log(err);
							db.close();
					    	var result = {success:false, msg : err};
							return res.send(result, 200);
						}
						
						if(docs.length > 0){
							var promises =[];
							for(var i=0; i < docs.length; i++){
								var doc = docs[i];
								//sendMessage(JSON.stringify(doc));	
								promises.push(sendMessage(doc));
							}
						
							Q.allSettled(promises).then(function(){
								db.close();	
							});	
						}else{
							db.close();
						}
					});
					
		 		}); 
				counter++;	
			}catch(e){
				//do nothing
				console.log(e);
			}
			
			
		}, 1000);




        // setInterval(function () {
        //     try{
        //         var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
        //         var Notifications = db.model("Notifications", notificationsSchema);
        //         // var search_key={"received" : false};
        //
        //         var search_key = {$or:[
        //         	{
        //         		'received':false
        //         	},
			// 		{
			// 			'received': {
			// 				$exists: false
			// 			}
			// 		}
			// 	]};
        //
        //
        //         db.once('open', function(){
        //             Notifications.find(search_key).exec(function(err, docs){
        //                 if(err){
        //                 	console.log(err);
        //                     db.close();
        //                     var result = {success:false, msg : err};
        //                     return res.send(result, 200);
        //                 }
        //
        //                 if(docs.length > 0){
        //                     var promises =[];
        //                     for(var i=0; i < docs.length; i++){
        //                         var doc = docs[i];
        //                         //sendMessage(JSON.stringify(doc));
        //                         promises.push(sendMessage(doc));
        //                     }
        //
        //                     Q.allSettled(promises).then(function(){
        //                         db.close();
        //                     });
        //                 }else{
        //                     db.close();
        //                 }
        //             });
        //
        //         });
        //         received_counter++;
        //     }catch(e){
        //         //do nothing
			// 	console.log(e);
        //     }
        //
        //
        // }, 2000);

        //setInterval(function () { sendMessage(JSON.stringify({key:18389274824862, message:counter})); counter++; }, 1000);
    }
});