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

var runningBalanceQueue = Queue("running_balance_checker", 6379, '127.0.0.1');
var syncRunningBalanceQueue = require("../bull/sync_running_balance");

runningBalanceQueue.process(function(job, done){
	console.log("Starting bull running_balance_checker process...");
	console.log("Indexing client #" + job.data.client_id);
	
	var client_id = job.data.client_id;
	var sync_today = job.data.today;
	
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);
  	
  	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
	
	console.log(client_id);
	console.log(sync_today);
	
	
	
	function getCouchRunningBalance(client_id, sync_today){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		//console.log(moment(today).year());
		//console.log((moment(today).month()+1));
		//console.log(moment(today).date());
		
		var start_key_date = [moment(today).year(), (moment(today).month()+1), moment(today).date(), 23, 59, 59, 99999];
		var end_key_date = [1970, 1, 1, 0, 0, 0];
		if(sync_today){
			var end_key_date = [moment(today).year(), (moment(today).month()+1), moment(today).date(), 0, 0, 0, 0];
		}
		
		//Get client running balance
		var queryOptions = {
			startkey : [ parseInt(client_id), start_key_date ], 
			endkey : [ parseInt(client_id), end_key_date ], 
			descending : true
		};
		console.log(queryOptions);
		
		couch_db.view('client','credit_accounting_transactions', queryOptions, function(err, response) {
	    	if (err) throw err;
	    	deferred_promise.resolve(response);
	  	});
		return promise;
	}
	
	
	 
	
	
	getCouchRunningBalance(client_id, sync_today).then(function(response){
		//console.log(response);
		if(response.rows.length == 0){
			console.log("Client has no running balance.");
			done(null, {success:true, err:"Client has no running balance."});
		}else{
			console.log("Retrieved client running balance.");
			if(typeof response.rows != "undefined"){
				for(var i=0; i<response.rows.length; i++){
					var doc = response.rows[i];					
					console.log("sending to sync_running_balance process" + doc.id);
					syncRunningBalanceQueue.add({couch_id : doc.id});
				}
			}
		}
	});
	
	
	done(null, {success:true});
});

module.exports = runningBalanceQueue;