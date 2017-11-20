var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");

var moment = require('moment');
var moment_tz = require('moment-timezone');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var LeaveRequest = require("../mysql/LeaveRequest");
var LeaveRequestDates = require("../mysql/LeaveRequestDates");

var Queue = require('bull');
var leaveRequestQueue = Queue("leave_request_checker", 6379, '127.0.0.1');
var syncLeaveRequestQueue = require("../bull/sync_leave_request");
//var syncLeaveRequestDatesQueue = require("../bull/sync_leave_request_dates");

leaveRequestQueue.process(function(job, done){
    console.log("Starting bull leave_request_checker process...");
    //done(null, {success:true});
    var params = job.data.params;
    
    function getAllLeaveRequest(params, page){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
        
        LeaveRequest.searchByGroupLimit(params, page).then(function(data){  

        	deferred_promise.resolve({leave_request : data.length, listRecords : data});
         
        }).catch(function(err){
            console.log(err);
            deferred_promise.reject(err);
            throw(err);            
        });
		return promise;
	}

	
	
    var allRecords = [];
	var deferredPromise = Q.defer();
	var promise = deferredPromise.promise;

	function recursiveLeaveRequestGet(params, page){
		console.log("Page " + page);
		getAllLeaveRequest(params, page).then(function(result){
			if (result.leave_request==0){
				deferredPromise.resolve(true);
			}else{				
				for(var i=0;i<result.listRecords.length;i++){
					allRecords.push(result.listRecords[i]);
				}
				recursiveLeaveRequestGet(params, page+1);
			}
		});
	}


    promise.then(function(){

        //console.log("All promises done");

        for(var i=0; i<allRecords.length; i++){
            var doc = allRecords[i];
            //console.log(doc);
            //console.log("sending to sync_leave_request_dates process " + doc.leave_request_id);
            syncLeaveRequestQueue.add({mongo_doc : doc});
        }

        done(null, {success:true});


	});

	
	recursiveLeaveRequestGet(params, 1);
});

module.exports = leaveRequestQueue;