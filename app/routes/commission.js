var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var Sequelize = require('sequelize');
var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var Commission = require("../mysql/Commission");
var WORKING_WEEKDAYS = 22;

router.all("*", function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


/*
 * Method in getting new tax invoice number
 * @url http://test.njs.remotestaff.com.au/commission/get-commision-by-leads-id/
 * @param int leads_id 
 */
router.all("/get-commision-by-leads-id", function(req,res,next){
	
	var sequelize = new Sequelize(mysqlCredentials.database,mysqlCredentials.user,mysqlCredentials.password,
		{
			host:mysqlCredentials.host,
			dialect: 'mysql'	
	});
	
	sequelize.query("SELECT commission_id, commission_title, commission_amount FROM commission WHERE leads_id = :leads_id AND status IN ('pending', 'approved')",  
		{ replacements: { leads_id: req.query.leads_id }, 
		type: sequelize.QueryTypes.SELECT, model:Commission }).then(function(commissions){
			var result = {
					success:true,
					result:commissions 
				};
			return res.send(result, 200);	
		});
});

module.exports = router;