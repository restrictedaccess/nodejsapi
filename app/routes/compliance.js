var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');


var subconSuspensionLogsSchema = require("../models/SubconSuspensionLogs");


var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


//http://test.njs.remotestaff.com.au/compliance/search-group-by-client/?start_date=2017-01-01&end_date=2017-01-31
router.all("/search-group-by-client", function(req,res,next){
	
	var start_date = req.query.start_date;
	var end_date = req.query.end_date;
	
	start_date = moment(start_date+" 00:00:00").unix();
	end_date = moment(end_date+" 23:59:59").unix();
	
	var search_key={"date_change_unix": {"$gte": start_date, "$lte": end_date}};
	
	if(typeof req.query.status != "undefined" && req.query.status != ""){
		search_key.contract_status = req.query.status;
	}
	
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet");
	var SubconSuspensionLogs = db.model("SubconSuspensionLogs", subconSuspensionLogsSchema);
	
	db.once('open', function(){
		var promises = [];		
		//console.log(search_key);
		var MongoClient = require('mongodb').MongoClient;
		MongoClient.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet", function(err, db){

			var filter = { $match: search_key};
			db.collection("subcon_suspension_logs").aggregate(
				[
					filter,					
					{ $group: { "_id": { leads_id : "$leads_id_str", client_name : "$client_name"  }, records: { $push: "$$ROOT" } , "count": { $sum: 1 } } }					
				]).toArray(function(err, docs) {
					if(err){
						console.log(err);
						db.close();
						var result = {success:false};
						return res.send(result, 200);
					}
					//console.log(docs);
					var result = {
						success:true,
						docs : docs				
					};
					return res.send(result, 200);
				});
		});
		
		
		
	});
	
	
});

//http://test.njs.remotestaff.com.au/compliance/search/?start_date=2017-01-01&end_date=2017-01-31
router.all("/search", function(req,res,next){
	
	var start_date = req.body.start_date;
	var end_date = req.body.end_date;
	
	
	start_date = moment(start_date+" 00:00:00").unix();
	end_date = moment(end_date+" 23:59:59").unix();
	//console.log("start_date " + start_date);
	//console.log("end_date " + end_date);
	
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet");
	var SubconSuspensionLogs = db.model("SubconSuspensionLogs", subconSuspensionLogsSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();
	
	var search_key={"date_change_unix": {"$gte": start_date, "$lte": end_date}};
	
	
	//console.log(typeof req.body.subcon_id);
	//console.log(typeof req.body.client_id);
	//console.log(typeof req.body.csro_id);
	
	
	if(typeof req.body.subcon_id != "undefined" && req.body.subcon_id != ""){
		search_key.subcon_id = parseInt(req.body.subcon_id);
	}
	
	if(typeof req.body.client_id != "undefined" && req.body.client_id != ""){
		search_key.leads_id = parseInt(req.body.client_id);
	}
	
	if(typeof req.body.csro_id != "undefined" && req.body.csro_id != ""){
		search_key.csro_id = parseInt(req.body.csro_id);
	}
	
	db.once('open', function(){
		var promises = [];
		
		console.log(search_key);
		SubconSuspensionLogs.find(search_key).sort({ 'date_change_unix' : -1}).exec(function(err, docs){
			if(err){
				db.close();
				var result = {success:false};
				return res.send(result, 200);
			}
			//console.log(docs);
			var result = {
				success:true,
				docs : docs				
			};
			return res.send(result, 200);
			
		});
	});
	
	
	//var result = {success:true};
	//return res.send(result, 200);
	
	
});

module.exports = router;
