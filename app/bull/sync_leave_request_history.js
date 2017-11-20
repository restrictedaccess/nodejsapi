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

var moment = require('moment');
var moment_tz = require('moment-timezone');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();


var LeaveRequestHistory = require("../mysql/LeaveRequestHistory");
var Utilities = require("../components/Utilities");

var syncLeaveRequestHistoryQueue = Queue("sync_leave_request_history", 6379, '127.0.0.1');


syncLeaveRequestHistoryQueue.process(function(job, done){
    console.log("Starting bull sync_leave_request_history process...");
    var leave_request_id = job.data.leave_request_id;
    //console.log(leave_request_id);
    //done(null, {success:true});

    function getLeaveRequestHistory(leave_request_id){
        var deferred_promise = Q.defer();
        var promise = deferred_promise.promise;

		LeaveRequestHistory.getHistory(leave_request_id).then(function(records){  

        	var logs=[];
        	records.forEach(function(record){
                Utilities.whosThis(record.response_by_id, record.response_by_type).then(function(the_who){
                    console.log(record.response_date);
                    logs.push({
                        id : record.id,
                        response_date_str : record.response_date,
                        notes : record.notes,
                        response_date : moment(record.response_date_str).toDate(),                        
                        response_by_id : record.response_by_id,
                        response_by_type : record.response_by_type,
                        response_by : the_who.name

                    });
                });
            });
            deferred_promise.resolve(logs);
         
        }).catch(function(err){
            console.log(err);
            deferred_promise.reject(err);
            throw(err);            
        });
		return promise;
    }



    var allLogs = null;
    var deferredPromise = Q.defer();
    var promise = deferredPromise.promise;

    function recursiveLeaveRequestHistoryGet(leave_request_id){
       
        getLeaveRequestHistory(leave_request_id).then(function(logs){
            deferredPromise.resolve(true);
            allLogs =logs;
        });
    }


    promise.then(()=>{

        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
            if(err){
                throw(err);
            }else{
                //console.log("Connected to MongoDB");
                var leave_request_collection = db.collection("leave_request");
                var filter = {leave_request_id : leave_request_id}; 

                leave_request_collection.update(filter, { $set: {history:allLogs}} , {upsert:true}, function(err, result) {
                    if(err){
                        throw(err);
                        console.log(err);
                        db.close(); 
                    }else{  
                        db.close(); 
                        console.log("Synced History for Leave Request ID #" + leave_request_id);
                        done(null, {success:true});
                    }

                });
                
            }
        });    
    });
    
    recursiveLeaveRequestHistoryGet(leave_request_id);


});

module.exports = syncLeaveRequestHistoryQueue;