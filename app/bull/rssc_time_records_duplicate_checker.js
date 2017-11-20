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
var timeRecordsSchema = require("../models/TimeRecords");

var Queue = require('bull');
var timeRecordsDuplicateCheckerQueue = Queue("rssc_time_records_duplicate_checker", 6379, '127.0.0.1');

timeRecordsDuplicateCheckerQueue.process(function(job, done){
	console.log("Starting bull process...");
	//console.log(job.data.couch_id);
	
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();
	var created = [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()];
	//console.log(created);
	//done(null, {success:true});

	
	
	
	
	function getAllRsscTimeRecords(page){
		var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		var TimeRecords = db.model("TimeRecords", timeRecordsSchema);
		
		var deferredPromiseTimeRecords = Q.defer();
		var deferredPromiseTimeRecordsPromise = deferredPromiseTimeRecords.promise;
		var time_records=[];
		var promises = [];
		
		db.once('open', function(){
			if (typeof page=="undefined"){
				page = 1;
			}

			var limit = 5000;
			var time_records = [];
			var skips = (page-1) * limit;

			TimeRecords.find()
				.skip(skips)
				.limit(limit)
				.exec(function(err, docs){
					
					console.log("Page : " + page);
					
					function checkDuplicate(doc){
						var deferred_promise = Q.defer();
						var promise = deferred_promise.promise;
						TimeRecords.find({couch_id:doc.couch_id}).exec(function(err, rows){
							deferred_promise.resolve({count:rows.length, couch_id:doc.couch_id});
						});
						return promise;
					}
					
					
					
					if (!err)
					{
						var promises = [];
						var listTimeRecords = [];
						for(var i=0;i<docs.length;i++)
						{
							
							var doc = docs[i];
							//console.log("Checking couch_id : " + doc.couch_id);
							var promiseTimeRecord = checkDuplicate(doc);							
							promiseTimeRecord.then(function(response){								
								//console.log(response);
								if (response.count > 1){
									//console.log("Duplicate record found : " + response.couch_id);
									listTimeRecords.push(response.couch_id);
								}
							});
							promises.push(promiseTimeRecord);
									
						}
					}
					
					
					var allPromise = Q.all(promises);
					allPromise.then(function(results){
						console.log("All promises done for page " + page);							
						db.close();
						deferredPromiseTimeRecords.resolve({timerecords:docs.length, listTimeRecords:listTimeRecords});
	
					});
					
					
			});

		});

		return deferredPromiseTimeRecordsPromise;
	}


	var allTimeRecords = [];
	var deferredPromise = Q.defer();
	var promise = deferredPromise.promise;

	function recursiveTimeRecordsGet(page){
		console.log(page);
		getAllRsscTimeRecords(page).then(function(result){
			if (result.timerecords==0){
				deferredPromise.resolve(true);
			}else{				
				for(var i=0;i<result.listTimeRecords.length;i++){
					allTimeRecords.push(result.listTimeRecords[i]);
				}
				recursiveTimeRecordsGet(page+1);
			}
		});
	}

	promise.then(()=>{
		console.log("Duplicate rssc time records : ");
		console.log(allTimeRecords);

		//Send mail
		var mailbox_doc = {
			bcc : null,
			cc : null,
			created : created,
			from : "noreply<noreply@remotestaff.com.au>",
			sender : null,
			reply_to : null,
			generated_by : "NODEJS/bull/rssc_time_records_duplicate_checker/",
			html : "<p>Duplicate records</p>"+allTimeRecords.join(),
			text : null,
			to : ["devs@remotestaff.com.au"],
			sent : false,
			subject : "RSSC Time Records Checker",
		};
		//console.log(mailbox_doc);
		
		
		mailbox.insert(mailbox_doc, function(err, body){
			if (err) {
				console.error(err);       		
			}
			console.log("saved to mailbox");
			done(null, {success:true});           
		});

		done(null, {success:true});		 
	});
	
	recursiveTimeRecordsGet(1);	
	
});

module.exports = timeRecordsDuplicateCheckerQueue;