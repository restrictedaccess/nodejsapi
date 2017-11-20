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
http.post = require("http-post");
var Subcontractors = require("../mysql/Subcontractors");
var subcontractorSchema = require("../models/Subcontractor");
var lockTimesheetSchema = require("../models/LockTimesheet");
var mongoCredentials = configs.getMongoCredentials();

//var timesheet_adjustments = require('./routes/timesheet_adjustments');
//app.use('/timesheet-adjustments', timesheet_adjustments);

router.all("*", function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

/**
 * Normaneil E. Macutay <normaneil.macutay@gmail.com>
 * Timesheet adjustments
 * @param int subcontractors_id
 * @param records (Object)
 * @param int admin_id
 * @url http://test.njs.remotestaff.com.au/timesheet-adjustments/lodge-to-rbs/
 * */


router.post("/lodge-to-rbs", function(req, res, next) {
	
	//Check if there's current backgrond process of updating timesheets
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet");
	var LockTimesheet = db.model("LockTimesheet", lockTimesheetSchema);
	var Subcontractors = db.model("Subcontractors", subcontractorSchema);
	
	//console.log(req.body);
	//console.log("admin_id : " + req.body.admin_id);
	//console.log("subcontractors_id : " + req.body.subcontractors_id);
	
	var admin_id = req.body.admin_id;
	var subcontractors_id = req.body.subcontractors_id;
			
	return db.once('open', function(){
		
		//Check if there's current backgrond process of updating timesheets
		LockTimesheet.findOne({build:"yes"}).exec(function(err, lock_doc){
			if(err){
				console.lo(err);
				db.close();
		    	var result = {success:false, msg : "There's a problem in checking lock timesheets status"};
				return res.send(result, 200);
			}
			if(lock_doc)
			{
				console.log("lock_doc : " + lock_doc);
				db.close();
				var result = {success:false, msg : "Timesheet adjustments is not yet available due to ongoing process of "+lock_doc.status};
				return res.send(result, 200);
			
			}
			//db.close();
			console.log("No build process of timesheets");
				
			
		
			console.log("admin_id : " + admin_id);
			console.log("subcontractors_id : " + subcontractors_id);
			
			var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
			var Subcontractors = db.model("Subcontractors", subcontractorSchema);
			
			db.once('open', function(){
				
				
				var promises = [];
				Subcontractors.findOne({subcontractors_id:parseInt(subcontractors_id)}).exec(function(err, doc){
					if(err){
						db.close();
				    	var result = {success:false, msg : err};
						return res.send(result, 200);
					}
					//console.log(doc.leads_detail.id);
					
					
					var per_promise = [];
				    function delay(){ return Q.delay(100); }
				    
				    doc.db = db;
				    doc.client_id = doc.leads_detail.id;
				    
				    //Get Client Basic Info
				  	var promise_client_setting = doc.getClientSettings();
				  	
				  	per_promise.push(promise_client_setting);
				    per_promise.push(delay);
				    
				    //Check all settled promises
				    per_promises_promise = Q.allSettled(per_promise);
				    promises.push(per_promises_promise);
				    promises.push(delay);
		
		
				    var allPromise = Q.allSettled(promises);
					allPromise.then(function(results){
		
						
						//console.log(doc);
						db.close();
						var result = {success:true, invoice : doc};
						return res.send(result, 200);
					});
				  	
					
					
				});
				
				
				
			});
			
			
			
			
			
			
			
			//var result = {success:false, msg : "No build process of timesheets"};
			//return res.send(result, 200);
			
			
			
		});
	});
	/*
	console.log("admin_id : " + req.body.admin_id);
	console.log("subcontractors_id : " + req.body.subcontractors_id);
	
	var admin_id = req.body.admin_id;
	var subcontractors_id = req.body.subcontractors_id;
	
	
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Subcontractors = db.model("Subcontractors", subcontractorSchema);
	
	db.once('open', function(){
		
		
		var promises = [];
		Subcontractors.findOne({subcontractors_id:parseInt(subcontractors_id)}).exec(function(err, doc){
			if(err){
				db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}
			//console.log(doc.leads_detail.id);
			
			
			var per_promise = [];
		    function delay(){ return Q.delay(100); }
		    
		    doc.db = db;
		    doc.client_id = doc.leads_detail.id;
		    
		    //Get Client Basic Info
		  	var promise_client_setting = doc.getClientSettings();
		  	
		  	per_promise.push(promise_client_setting);
		    per_promise.push(delay);
		    
		    //Check all settled promises
		    per_promises_promise = Q.allSettled(per_promise);
		    promises.push(per_promises_promise);
		    promises.push(delay);


		    var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){

				
				console.log(doc.client_setting);
				db.close();
				var result = {success:true, invoice : doc};
				return res.send(result, 200);
			});
		  	
			
			
		});
		
		
		
	});
	*/
	/*
	Subcontractors.getSubconInfo(subcontractors_id).then(function(subcon){
		
		//var userid = subcon.userid;
		//var leads_id = subcon.leads_id;
		//var client_price = subcon.client_price;
		//var work_status = subcon.work_status;    
		
	}).catch(function(err){
		console.log("Staff contract does not exist : " + err);
	});
	*/
	
	/*
	var records = req.body.records;
	for (var key in records) {
  		if (records.hasOwnProperty(key)) {
  			obj = records[key];
    		//console.log(obj);
    		
    		var timesheet_id =  obj.timesheet_id;
    		//console.log("timesheet_id -> " + timesheet_id);
			var timesheet_details_id =  obj.timesheet_details_id;
			//console.log("timesheet_details_id -> " + timesheet_details_id);
			var adj_hrs = obj.adj_hrs;
			//console.log("adj_hrs -> " + adj_hrs);
			var original_adj_hrs = obj.original_adj_hrs;
			//console.log("original_adj_hrs -> " + original_adj_hrs);
			var reference_date = obj.reference_date;
			//console.log("reference_date -> " + reference_date);
			var total_worked_hours = obj.total_worked_hours;
			//console.log("total_worked_hours -> " + total_worked_hours);
  		}
	}
	*/
	
	
	
	
	//var result = {success:false};
	//return res.send(result, 200);
});


function getSubconInfo(subcontractors_id , cb){
	
	//Check if the staff has active contracts
	Subcontractors.getSubconInfo(subcontractors_id).then(function(subcon){
		//console.log(JSON.stringify(subcon));
		var userid = subcon.userid;
		var leads_id = subcon.leads_id;
		var client_price = subcon.client_price;
		var work_status = subcon.work_status;
		
		
		cb({userid:userid});
	    //return res.send(result, 200);
	    
	    //return JSON.stringify(subcon);
	}).catch(function(err){
		console.log("Staff contract does not exist : " + err);
	});
}
/*
router.all("/signin", function(req,res,next){
	var result;
	if (typeof req.body.email == "undefined" || req.body.email==""){
		result = {success:false, error:"no email"};
		return res.send(result, 200);
	}
	
	if (typeof req.body.password == "undefined" || req.body.password==""){
		result = {success:false, error:"no password"};
		return res.send(result, 200);
	}
	
	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var promises = [];
	
	var per_promise = [];
	function delay(){ return Q.delay(100); }
	
	
	
	//Check if existing in personal table
	return Personal.signin(req.body.email, sha1(req.body.password)).then(function(record){
		//console.log(record);
		if(record){
			
			
			//Check if the staff has active contracts
			Subcontractors.getActiveContracts(record.userid).then(function(contracts){
				//console.log(contracts);
				result = {
					success:true, 
					result : record,
					contracts : contracts
				};
				return res.send(result, 200);
			}).catch(function(err){
				result = {
					success:false,
					msg : err+ "Subcontractors.getActiveContracts"
				};
				return res.send(result, 200);
			});
			
			
		}else{
			result = {
				success:false,
				msg : "Email / Password does not match."
			};
			return res.send(result, 200);
		}
	}).catch(function(err){
		result = {
			success:false,
			msg : err+ "Personal.signin"
		};
		return res.send(result, 200);
	});
	
	
	//return res.send(result, 200);
});
*/
module.exports = router;



