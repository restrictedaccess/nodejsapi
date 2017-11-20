var Q = require('q');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();



var moment = require('moment');
var moment_tz = require('moment-timezone');
var env = require("../config/env");

var adminInfoSchema = require("../mysql/Admin_Info");
var agentInfoSchema = require("../mysql/Agent_Info");
var leadInfoSchema = require("../mysql/Lead_Info");
var personalInfoSchema = require("../mysql/Personal_Info");
var managersInfoSchema = require("../mysql/ClientManagers");
var Utilities = function(){};





Utilities.prototype.whosThis = function(id, type){

	
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	
	if(type=="admin")
	{
		adminInfoSchema.getAdminInfo(id).then(function(data){

			
			willFulfillDeferred.resolve({
				id: data.admin_id,
				fname : data.admin_fname,
				lname : data.admin_lname,
				email : data.admin_email,
				name : data.admin_fname+" "+data.admin_lname
			});


		}).catch(function(err){

			console.log(err);
			willFulfillDeferred.resolve(error);
		});

	}
	else if(type=="agent")
	{
		agentInfoSchema.getAgentInfo(id).then(function(data){

			willFulfillDeferred.resolve({
				id: data.agent_no,
				fname : data.fname,
				lname : data.lname,
				email : data.email,
				name : data.fname+" "+data.lname
			});

		}).catch(function(err){

			console.log(err);
			willFulfillDeferred.resolve(error);

		});


	}
	else if(type=="personal")
	{
		personalInfoSchema.basicInfo(id).then(function(data){

			willFulfillDeferred.resolve({
				id: data.userid,
				fname : data.fname,
				lname : data.lname,
				email : data.email,
				name : data.fname+" "+data.lname
			});


		}).catch(function(err){
			console.log(err);
			willFulfillDeferred.resolve(error);
		});

	}
	else if(type=="leads")
	{
		leadInfoSchema.getLeadsInfo(id).then(function(data){

			willFulfillDeferred.resolve({
				id: data.id,
				fname : data.fname,
				lname : data.lname,
				email : data.email,
				name : data.fname+" "+data.lname
			});


		}).catch(function(err){
			console.log(err);
			willFulfillDeferred.resolve(error);
		});
	}
	else if(type=="client_managers")
	{
		managersInfoSchema.getBasicInfo(id).then(function(data){

			willFulfillDeferred.resolve({
				id: data.id,
				fname : data.fname,
				lname : data.lname,
				email : data.email,
				name : data.fname+" "+data.lname
			});


		}).catch(function(err){
			console.log(err);
			willFulfillDeferred.resolve(error);
		});
	}
	else
	{
		return null;
	}

	return willFulfill;
};

// You need to assign a new function here
Utilities.prototype.DateRange = function (start, end) {
    
    start = moment(start).toDate();
	end = moment(end).toDate();			
	var date_range = [];
    while(start <= end){
       date_range.push( moment(start).format('YYYY-MM-DD') );
       start = moment(start).add(1, 'days');             
    }
    
    return date_range;
};


module.exports = new Utilities();
