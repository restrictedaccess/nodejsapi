var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Queue = require('bull');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var clientSchema = require("../models/Client");
var Lead_Info = require("../mysql/Lead_Info");

var clientSettingsQueue = Queue("client_settings_checker", 6379, '127.0.0.1');

clientSettingsQueue.process(function(job, done){
	console.log("Starting bull client_settings_checker process...");
	console.log("Indexing client #" + job.data.client_id);
	
	var client_id = job.data.client_id;
	
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);
  	
  	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
	
	function getCouchClientSettings(client_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		
		//Get Client Settings
		var queryOptions = {startkey : [parseInt(client_id), [moment(today).year(), (moment(today).month()+1), moment(today).date(), 0, 0, 0]], endkey : [parseInt(client_id), [2011, 0, 0, 0, 0, 0]], descending : true, limit : 1};
		couch_db.view('client','settings', queryOptions, function(err, response) {
	    	if (err) throw err;
	    	deferred_promise.resolve(response);
	  	});
		return promise;
	}
	
	function getCouchDocument(couch_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		
		couch_db.get(couch_id, function(err, body){
			delete body._id;
			delete body._rev;
			//body.timestamp =
			//if(body.timestamp[1] < 10){
			//	body.timestamp[1] = "0"+body.timestamp[1];
			//}
			//var timestamp = body.timestamp[0]+"-"+body.timestamp[1]+"-"+body.timestamp[2]+" "+body.timestamp[3]+":"+body.timestamp[4]+":"+body.timestamp[5];
			//body.timestamp = moment(timestamp).toDate(); 
  			deferred_promise.resolve(body);
 	 	});
		return promise;
	}
	
	function getClientInfo(client_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		Lead_Info.getClientInfo(client_id).then(function(client){
			if(client){
				delete client[0].password;
				client[0].fullname = client[0].fname+" "+client[0].lname;				
				client[0].timestamp = moment(client[0].timestamp).toDate();
				if(typeof client[0].registration_dates !="undefined" && client[0].registration_dates !=""){
					client[0].registration_dates = moment(client[0].registration_dates).toDate();
				}		
						
				deferred_promise.resolve(client[0]);	
			}
			
		});
		return promise;
	}
	
	function isActiveClient(client_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		Lead_Info.getTotalActiveStaff(client_id).then(function(total){
			
			var is_active = false;
			if(total){
				if(total[0].total_active > 0){
					is_active = true;	
				}				 
			}
			deferred_promise.resolve(is_active);			
		});
		return promise;
	}
	
	
	
	getCouchClientSettings(client_id).then(function(response){
		//console.log(response.rows);			
		if(response.rows.length == 0){
			console.log("Client settings not found in couchdb client_docs.");
			done(null, {success:true, err:"Client settings not found in couchdb client_docs."});
		}else{
			console.log("Retrieved client settings.");
			if(typeof response.rows != "undefined"){
				for(var i=0; i<response.rows.length; i++){
					var doc = response.rows[i];
					//console.log(doc.id);				
					var couch_id = doc.id;
					var client_id = doc.key[0];
					var timestamp = doc.key[1];
					if(timestamp[1] < 10){
						timestamp[1] = "0"+timestamp[1];
					}
					timestamp = timestamp[0]+"-"+timestamp[1]+"-"+timestamp[2]+" "+timestamp[3]+":"+timestamp[4]+":"+timestamp[5];				
					timestamp = moment(timestamp).toDate();
					var currency = doc.value[0];
					var apply_gst = doc.value[1];
					
									
					getCouchDocument(couch_id).then(function(doc){
						//console.log(doc);					
						//console.log(timestamp);				
						//console.log(couch_id+" "+client_id+" "+currency+" "+apply_gst);
						console.log("Retrieved document.");
						
						getClientInfo(client_id).then(function(client){
							//console.log(client);
							console.log("Retrieved client info in mysql.");
							
							isActiveClient(client_id).then(function(is_active){
								
								console.log("Checking if client is active : "+ is_active);
								
								client.active = is_active;
								doc.client_fname = client.fname;
								doc.client_lname = client.lname;
								doc.client_email = client.email;
								var mongo_doc = {
									client_id : client_id,
									couch_id : couch_id,						
									currency : currency,
									apply_gst : apply_gst,
									timestamp : timestamp,
									date_synced : today,
									client_doc : doc,
									lead : client								
								};						
								
								var MongoClient = require('mongodb').MongoClient;
								MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
									var client_settings_collection = db.collection("client_settings");
									var filter = {client_id:parseInt(client_id)};
									//console.log(mongo_doc);
									client_settings_collection.findOneAndUpdate(filter, mongo_doc, {upsert:true}, function(err, doc){
									    if (err) {
									    	db.close(); 
									    	console.log(err);
									    }
									    db.close();
									    console.log("synced succesfully");
									});	
								});			
							});													
						});
					});				
				}
			}
		}	
		
		
	});
	
	
	done(null, {success:true});
});

module.exports = clientSettingsQueue;