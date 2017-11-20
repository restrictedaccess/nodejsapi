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

var syncRunningBalanceQueue = Queue("sync_running_balance", 6379, '127.0.0.1');


syncRunningBalanceQueue.process(function(job, done){
	console.log("Starting bull sync_running_balance process...");
	console.log("Indexing coudb #" + job.data.couch_id);
	
	var couch_id = job.data.couch_id;
		
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);
  	
  	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
		
	console.log(couch_id);
	
	done(null, {success:true});
});

module.exports = syncRunningBalanceQueue;