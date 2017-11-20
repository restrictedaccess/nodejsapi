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

var syncLeaveRequestQueue = Queue("sync_leave_request", 6379, '127.0.0.1');
var syncLeaveRequestDatesQueue = require("../bull/sync_leave_request_dates");
var syncLeaveRequestHistoryQueue = require("../bull/sync_leave_request_history");

syncLeaveRequestQueue.process(function(job, done){
	//console.log("Starting bull sync_leave_request process...");
    var mongo_doc = job.data.mongo_doc;

    //console.log("Indexing Leave Request ID #" + mongo_doc.leave_request_id);
    //console.log("Indexing Leave Request Date ID #" + mongo_doc.leave_request_dates_id);
	//console.log(mongo_doc);
    //done(null, {success:true});
    
    
    function syncLeaveRequest(mongo_doc){
        var deferred_promise = Q.defer();
        var promise = deferred_promise.promise;

        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
            if(err){
                throw(err);
            }else{
                //console.log("Connected to MongoDB");
                var leave_request_collection = db.collection("leave_request");
                var filter = {leave_request_id : mongo_doc.leave_request_id};
                
                mongo_doc.date_requested= moment(mongo_doc.date_requested_str).toDate();
                mongo_doc.date_requested_str= moment(mongo_doc.date_requested_str).toDate();
                                
                leave_request_collection.findOneAndUpdate(filter, mongo_doc, {upsert:true}, function(err, doc){
                    if (err) {
                        db.close(); 
                        console.log(err);
                        deferred_promise.reject(err);
                        throw(err);
                    }else{
                        db.close();                
                        //console.log("synced succesfully");
                        console.log("Synced Leave Request ID #" + mongo_doc.leave_request_id);
                        deferred_promise.resolve(doc);
                    }
                    
                });	            
                return promise;
            }
        });
        

        return promise;
    }


    syncLeaveRequest(mongo_doc).then(function(doc){
		//console.log(doc.value._id);
        //console.log(doc.value.leave_request_id);   
        syncLeaveRequestDatesQueue.add({leave_request_id : mongo_doc.leave_request_id});  
        syncLeaveRequestHistoryQueue.add({leave_request_id : mongo_doc.leave_request_id});  
        done(null, {success:true});
	});
	
	
});

module.exports = syncLeaveRequestQueue;