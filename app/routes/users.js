var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var mongo = require("../config/mongo");
var UserComponent = require('../components/User');
var console = require('console');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


/* GET Applicant  info */
router.get('/all-clients', function(req, res, next) {
	var mysql_connection = configs.getMysql();
	var id = req.query.id;
	
	function callback_getAllClients(rows){
		res.send(JSON.stringify(rows));	
	}
	var user = new UserComponent(mysql_connection);
	user.getAllClients(id, callback_getAllClients);
});


/* GET Client info */
router.get('/client', function(req, res, next) {
	var mysql_connection = configs.getMysql();
	var id = req.query.id;
	
	function callback_getClient(rows){
		res.send(JSON.stringify(rows[0]));	
	}
	var user = new UserComponent(mysql_connection);
	user.getClient(id, callback_getClient);
	
	
	/*
	var mysql_connection = configs.getMysql();
 	var id = req.query.id;
  	res.setHeader('Content-Type', 'application/json');
  	mysql_connection.connect();  
  	var query = "SELECT fname, lname FROM leads WHERE id =" + id;
  	mysql_connection.query(query, function(err, rows, fields) {
		
		if (err) throw err;
	  	
	  	//prepare output
	  	var response = {success:true, result:rows};
	  	res.send(JSON.stringify(response));
	  
      	mysql_connection.end();
	});
  	*/
	  
});

/* GET Applicant  info */
router.get('/applicant', function(req, res, next) {
	var mysql_connection = configs.getMysql();
	var id = req.query.id;
	
	function callback_getApplicant(rows){
		res.send(JSON.stringify(rows[0]));	
	}
	var user = new UserComponent(mysql_connection);
	user.getApplicant(id, callback_getApplicant);
});


/* GET Admin  info */
router.get('/admin', function(req, res, next) {
	var mysql_connection = configs.getMysql();
	var id = req.query.id;
	
	function callback_getAdmin(rows){
		res.send(JSON.stringify(rows[0]));	
	}
	var user = new UserComponent(mysql_connection);
	user.getAdmin(id, callback_getAdmin);
});


/* GET Client Setting  info */
router.get('/client-settings', function(req, res, next) {
	var mongodb = mongo.getDb("prod");
	res.send(JSON.stringify(mongodb));	
	//var id = req.query.id;	
	//function callback_getClientSettings(rows){
	//	res.send(JSON.stringify(rows));	
	//}
	//var user = new UserComponent(mongodb);
	//user.getClientSettings(id, callback_getClientSettings);
});



module.exports = router;
