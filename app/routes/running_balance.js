var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var http = require("http");
var swig  = require('swig');


var availableBalanceSchema = require("../models/AvailableBalance");
var runningBalanceSchema = require("../models/RunningBalance");

var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


/*
 * http://test.njs.remotestaff.com.au/running-balance/get-client-transactions/ 
 * 
 * */
router.all("/get-client-transactions", function(req,res,next){
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod"); 	
	var RunningBalance = db.model("RunningBalance", runningBalanceSchema);
 	var numrows = 50;
 	var page = 0;
	var search_key = {};
	if(req.query){
		var client_id = req.query.client_id;
		var page = parseInt(req.query.page);
		var start_date = req.query.start_date;
		var end_date = req.query.end_date;
		search_key = {
			client_id: parseInt(client_id),
			added_on:{ 
				$gte: moment(start_date), 
				$lte: moment(end_date) 
			} 
		};
	}
	
 	console.log("Page => "+page);
 	//console.log(search_key);
	db.once('open', function(){
		
		RunningBalance.count(search_key, function(err, count) {
			console.log('Total number of docs is ' + count);
        	var total_num_docs =  count;
        	
        	RunningBalance.find(search_key).limit(numrows).skip(numrows * page).sort({ 'added_on' : 'desc'}).exec(function(err, docs){
				if(err){
					db.close();
			    	var result = {success:false, msg : err};
					return res.send(result, 200);
				}
				
				var numpages = Math.ceil(total_num_docs / numrows);
				var next_page = 0;
				if( (page + 1) < numpages){
					var next_page = page + 1;
				}
				
				var result = {	
					success:true, 
					docs : docs, 
					total_docs : total_num_docs, 
					next_page : next_page, 
					numrows : numrows, 
					numpages : numpages
				};
				return res.send(result, 200);
			
			});	
			        	
      	});
		
	});
	
});	




	
module.exports = router;