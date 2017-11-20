var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var moment = require('moment');
var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var clientSchema = require("../models/Client");
// var clientSettingsQueue = require("../bull/client_settings_checker");
// var runningBalanceQueue = require("../bull/running_balance_checker");
var leadsQueue = require("../bull/leads");
// var quoteQueue = require("../bull/quote");
var leaveRequestQueue = require("../bull/leave_request_checker");


// var pool = mysql.createPool({
// 	host : mysqlCredentials.host,
// 	user : mysqlCredentials.user,
// 	password : mysqlCredentials.password,
// 	database : mysqlCredentials.database
// });

router.all("*", function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});



/*
 * Method in syncing Leave Request
 * Date Range : http://test.njs.remotestaff.com.au/sync/leave-request/?start_date=2017-01-01&end_date=2017-03-31
 * Per Leave Request : http://test.njs.remotestaff.com.au/sync/leave-request/?id=23454
 * */
router.all("/leave-request", function(req, res, next){
	
	//console.log(req.query);
	leaveRequestQueue.add({params : req.query});
	return res.status(200).send({success:true});
	
});

/*
 * Method in syncing client running balance
 * http://test.njs.remotestaff.com.au/sync/running-balance/?client_id=11&today=1
 *
 * */
router.all("/running-balance", function(req, res, next){

	var today = false;
	var client_id = req.query.client_id;
	if(typeof req.query.today != "undefined" && req.query.today !=""){
		var today = req.query.today;
		if(today == 1 || today == "1"){
			today = true;
		}else{
			today = false;
		}
	}

	if(typeof client_id != "undefined" && client_id !=""){
		runningBalanceQueue.add({client_id : client_id, today :  today});
		return res.status(200).send({success:true});
	}else{
		return res.status(200).send({success:false, err: "No client_id detected"});
	}


});

/*
 * Method in syncing client settings from couchdb to mongodb
 * http://test.njs.remotestaff.com.au/sync/client-settings/?client_id=11
 * */
router.all("/client-settings", function(req, res, next){

	if(typeof req.query.client_id != "undefined" && req.query.client_id !=""){
		clientSettingsQueue.add({client_id : req.query.client_id});
		return res.status(200).send({success:true});
	}else{
		return res.status(200).send({success:false, err: "No client_id detected"});
	}


});


//for leads
// router.all("/leads-queue", function(req, res, next){
//
// 	if(typeof req.query.leads_id != "undefined" && req.query.leads_id !=""){
// 		leadsQueue.add({leads_id : req.query.leads_id});
// 		return res.status(200).send({success:true,msg:"Sync "+req.query.leads_id});
// 	}else{
// 		leadsQueue.add({leads_id : req.query.leads_id});
// 		return res.status(200).send({success:true,msg:"Sync all"});
// 	}
//
// });



//for quote
// router.all("/quote-queue",function(req,res,next){
//
// 	if(typeof req.query.quote_id != "undefined" && req.query.quote_id !=""){
// 		quoteQueue.add({quote_id : req.query.quote_id});
// 		return res.status(200).send({success:true,msg:"Sync "+req.query.quote_id});
// 	}else{
// 		quoteQueue.add({quote_id : req.query.quote_id});
// 		return res.status(200).send({success:true,msg:"Sync all"});
// 	}
// });


// sync to solr(quote)
router.all("/solr-sync-quote",function(req,res,next){

	if(typeof req.query.leads_id != "undefined" && req.query.leads_id !=""){
		leadsQueue.add({leads_id : req.query.leads_id});
		return res.status(200).send({success:true,msg:"Sync "+req.query.leads_id});
	}else{
		leadsQueue.add({leads_id : req.query.leads_id});
		return res.status(200).send({success:true,msg:"Sync all"});
	}
});


module.exports = router;