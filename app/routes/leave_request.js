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
var mongoCredentials = configs.getMongoCredentials();


var LeaveRequest = require("../mysql/LeaveRequest");
var LeaveRequestDates = require("../mysql/LeaveRequestDates");
var LeaveRequestHistory = require("../mysql/LeaveRequestHistory");
var leaveRequestSchema = require("../models/LeaveRequest");

var Utilities = require("../components/Utilities");

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


	
router.all("/test-date", function(req,res,next){
	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var phil_timestamp = atz.toDate();
	
    phil_timestamp = moment(phil_timestamp).format("YYYY-MM-DD HH:mm:ss");

	var result = {
		success:true,
		result : phil_timestamp					
	};
	return res.send(result, 200);
	
});	

/*
 * For daashboard
 * http://test.njs.remotestaff.com.au/leave-request/total-number-leaves-per-status-by-date-range/?start_date=2017-03-07&end_date=2017-03-07
 * */ 
router.all("/total-number-leaves-per-status-by-date-range", function(req,res,next){

	
	var start_date = moment(req.query.start_date+" 00:00:00").unix();
	var end_date = moment(req.query.end_date+ " 23:59:59").unix();
	
	search_key = {"date_items.date_of_leave_unix": {"$gte": start_date, "$lte": end_date}};
	
	
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var LeaveRequest = db.model("LeaveRequest", leaveRequestSchema);
	
	var status = ['pending', 'approved', 'absent', 'denied', 'cancelled'];
	
	db.once('open', function(){
		var clients=[];
		var promises = [];
		var pages = [];
		var total_num_docs = 0;
		
		LeaveRequest.find(search_key)
    		.lean()				
			.sort({ 'date_items.date_of_leave_unix' : 1})
			.exec(function(err, docs){

				if(err){
					db.close();
		    		var result = {success:false, msg : err};
					return res.send(result, 200);
				}
				
				
				var data=[];
				var pending =0;
				var approved =0;											
				var absent =0;
				var cancelled =0;
				var denied =0;
				for(var i=0; i<docs.length; i++){
					
					var doc = docs[i];
					//console.log(doc._id);
					//console.log(doc.date_items);						
					var date_items=[];
					for(var j=0; j<doc.date_items.length; j++){
						var d = doc.date_items[j];
						//console.log(d);
						
						if(d.date_of_leave_unix >= start_date && d.date_of_leave_unix <= end_date){
							//date_items.push(d);
							
							if(d.status == "pending"){
								pending = pending + 1;
							}
							
							if(d.status == "approved"){
								approved = approved + 1;
							}
							
							if(d.status == "absent"){
								absent = absent + 1;
							}
							
							if(d.status == "denied"){
								denied = denied + 1;
							}
							
							if(d.status == "cancelled"){
								cancelled = cancelled + 1;
							}
						}							
					}
					
				}
				
				db.close();
				var result = {
					success:true,
					result : {pending : pending, approved : approved, absent:absent, denied:denied, cancelled:cancelled}					
				};
				return res.send(result, 200);

        });
        
    });


		
	
});

router.post("/add-leave-request", function(req,res,next){
	//console.log(req.body);
	var status = req.body.leave_type;
	if(status == "Absent"){
		status = "absent";
	}else{
		status = "pending";
	}
	var date_range = Utilities.DateRange(req.body.start_date, req.body.end_date);
	//console.log(date_range);
	
	
	//Insert record
	LeaveRequest.addLeaveRequest(req.body).then(function(leave_request_id){
		console.log("Added leave_request_id : "+leave_request_id);
		
		//Insert the date of leave
		LeaveRequestDates.addLeaveRequestDates(leave_request_id, date_range, status).then(function(response){
			console.log("Dates added leave_request_id : "+leave_request_id+" "+response);
			
			
			//Add Logs
			LeaveRequestHistory.insertLogs(leave_request_id, req.body.admin, date_range, status).then(function(response){
				console.log("LeaveRequestHistory.insertLogs : " + response);
				
				//Sync Leave Request
				http.get("http://127.0.0.1:3000"+"/sync/leave-request/?id="+leave_request_id, (res) => {
					res.setEncoding('utf-8');
					var body = '';
					res.on('data', function(chunk){
						body += chunk;
					});
					res.on("end", function(){
						data = JSON.parse(body);
						console.log("Sync Leave Request");
						console.log(data);
					});
				});
				
				result = {
					success:true,
					msg : "Leave Request Added",
					result : leave_request_id
				};			
				return res.send(result, 200);
				
			
			}).catch(function(err){
	
				result = {
					success:false,
					msg: err.toString()
				};
				return res.send(result, 200);;
			});	
			
						
		}).catch(function(err){
			result = {
				success:false,
				msg: err.toString()
			};
			return res.send(result, 200);;
		});

	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};
		return res.send(result, 200);;
	});
	
});

router.post("/update-leave-request-dates-status", function(req,res,next){
	//console.log(req.body);
	
	var leave_request_id = req.body.leave_request_id;
	var status = req.body.status;
	var admin_id = req.body.admin_id;
	
	var leave_request_dates = req.body.selected_dates_id;
	var selected_date_ids =[];
	var selected_dates=[];
	for(var i=0; i<leave_request_dates.length; i++){
		//var d = moment(leave_request_dates[i].date_of_leave).format("YYYY-MM-DD");
		var d = leave_request_dates[i].date_of_leave_str;
		selected_date_ids.push(leave_request_dates[i].id);
		selected_dates.push(d);
	}
	
	//console.log(leave_request_dates_id);
	//console.log(selected_dates.join("<br>"));		
	//result = {
	//	success:true,
	//	result: selected_dates.join("<br>")
	//};
	//return res.send(result, 200);
	
	//Update Leave Request Date Of Leave
	LeaveRequestDates.updateLeaveRequestDatesStatus(leave_request_id, selected_date_ids, status).then(function(response){
		console.log("LeaveRequestDates.updateLeaveRequestDatesStatus : " + response);
		
		//Add Logs
		LeaveRequestHistory.insertLogs(leave_request_id, admin_id, selected_dates, status).then(function(response){
			console.log("LeaveRequestHistory.insertLogs : " + response);
			
			//Sync Leave Request
			http.get("http://127.0.0.1:3000"+"/sync/leave-request/?id="+leave_request_id, (res) => {
				res.setEncoding('utf-8');
				var body = '';
				res.on('data', function(chunk){
					body += chunk;
				});
				res.on("end", function(){
					data = JSON.parse(body);
					console.log("Sync Leave Request");
					console.log(data);
				});
			});
			
			
			/*
			http.get("http://127.0.0.1:3000"+"/leave-request/details/?leave_request_id="+leave_request_id, (resx) => {
				resx.setEncoding('utf-8');
				var body = '';
				resx.on('data', function(chunk){
					body += chunk;
				});
				resx.on("end", function(){
					data = JSON.parse(body);
					//console.log(data);
					result = {
						success:true,
						result: data.result
					};
					//console.log(result);
					return res.send(result, 200);
				});
			});
			*/
			result = {
				success:true
			};			
			return res.send(result, 200);
			
		
		}).catch(function(err){

			result = {
				success:false,
				msg: err.toString()
			};
			return res.send(result, 200);;
		});		
		

	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};
		return res.send(result, 200);;
	});
});

//http://test.njs.remotestaff.com.au/leave-request/details/?leave_request_id=26312
router.all("/details", function(req,res,next){
	
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var LeaveRequest = db.model("LeaveRequest", leaveRequestSchema);
	var search_key = {};


	if(req.query.leave_request_id){
		var leave_request_id = req.query.leave_request_id;
		console.log("req.query.leave_request_id => " + req.query.leave_request_id);
		search_key={leave_request_id:leave_request_id};
	}

	db.once('open', function(){
		var promises = [];
		LeaveRequest.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}
			var result = {success:true, result:doc};
			return res.send(result, 200);

		});
	});
	
	
			
});

//http://test.njs.remotestaff.com.au/leave-request/search
router.all("/search", function(req,res,next){
	//var result = {success:true};
	//return res.send(result, 200);	
	//var params={};	
	//params.userid = 74;
	//params.start_date = '2017-01-01';
	//params.end_date = '2017-01-31';
	console.log(req.body);
	LeaveRequest.search(req.body).then(function(data){
		
		result = {
			success:true,
			result: data
		};
		return res.send(result, 200);

	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};
		return res.send(result, 200);;
	});
});



router.post("/search-mongodb", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var LeaveRequest = db.model("LeaveRequest", leaveRequestSchema);
 	var numrows = 50;
 	var page = 0;
	var search_key = {};
	
	if(req.body){
		
		//var page = parseInt(req.body.page);
		var start_date = moment(req.body.start_date+" 00:00:00").unix();
		var end_date = moment(req.body.end_date+ " 23:59:59").unix();
		var status = req.body.status;
			
		search_key = {"date_items.date_of_leave_unix": {"$gte": start_date, "$lte": end_date}};
		
		if(typeof req.body.userid != "undefined" && req.body.userid != ""){
			search_key.userid = parseInt(req.body.userid);
		}		
		if(typeof req.body.csro_id != "undefined" && req.body.csro_id != ""){
			search_key.csro_id = parseInt(req.body.csro_id);
		}	
		if(typeof req.body.leads_id != "undefined" && req.body.leads_id != ""){
			search_key.leads_id = parseInt(req.body.leads_id);
		}

	}
 	
 	//console.log("Page => "+page);
 	console.log("start_date :" + req.body.start_date );
 	console.log("end_date :" + req.body.end_date );
 	console.log(search_key);
 	
 	// result = {
		// success:true,
		// result: search_key
	// };
	// return res.send(result, 200);
	
 	
	db.once('open', function(){
		var clients=[];
		var promises = [];
		var pages = [];
		var total_num_docs = 0;
		
		LeaveRequest.find(search_key)
    		.lean()				
			.sort({ 'date_items.date_of_leave_unix' : 1})
			.exec(function(err, docs){

				if(err){
					db.close();
		    		var result = {success:false, msg : err};
					return res.send(result, 200);
				}
				
				
				var data=[];										
				for(var i=0; i<docs.length; i++){
					
					var doc = docs[i];
					//console.log(doc._id);
					//console.log(doc.date_items);						
					var date_items=[];
					for(var j=0; j<doc.date_items.length; j++){
						var d = doc.date_items[j];
						//console.log(d);											
						if(d.date_of_leave_unix >= start_date && d.date_of_leave_unix <= end_date){
							if(typeof status != "undefined" && status == d.status){
								date_items.push(d);									
							}
							
							if(typeof status == "undefined"){
								date_items.push(d);									
							}
						}							
					}
					
					if(date_items.length > 0){
						data.push({
							doc_id : doc._id,
							leave_request_id : doc.leave_request_id,
							userid : doc.userid,
							leads_id : doc.leads_id,
							csro_id : doc.csro_id,							
							staff : doc.staff,
							client : doc.client,
							staffing_consultant : doc.staffing_consultant,
							leave_type : doc.leave_type,
							date_requested_str :  doc.date_requested_str,
							date_requested :  doc.date_requested,														
							date_items : date_items
						});
					}
				}
				
				
				var result = {
					success:true,
					result : data					
				};
				return res.send(result, 200);

        });
	    /*
		LeaveRequest.count(search_key, function(err, count) {
			console.log('Total number of docs is ' + count);
        	var total_num_docs =  count;


        	LeaveRequest.find(search_key)
        		.lean()
				.limit(numrows)
				.skip(numrows * page)
				.sort({ 'date_items.date_of_leave_unix' : 1})
				.exec(function(err, docs){

					if(err){
						db.close();
			    		var result = {success:false, msg : err};
						return res.send(result, 200);
					}
					delete docs.full_content;
					var numpages = Math.ceil(total_num_docs / numrows);
					var next_page = 0;
					if( (page + 1) < numpages){
						var next_page = page + 1;
					}
					
					var data=[];										
					for(var i=0; i<docs.length; i++){
						
						var doc = docs[i];
						console.log(doc._id);
						//console.log(doc.date_items);						
						var date_items=[];
						for(var j=0; j<doc.date_items.length; j++){
							var d = doc.date_items[j];
							//console.log(d);
							if(d.date_of_leave_unix >= start_date && d.date_of_leave_unix <= end_date){
								date_items.push(d);
							}							
						}
						
						data.push({
							doc_id : doc._id,
							leave_request_id : doc.leave_request_id,
							userid : doc.userid,
							leads_id : doc.leads_id,
							csro_id : doc.csro_id,							
							staff : doc.staff,
							client : doc.client,
							staffing_consultant : doc.staffing_consultant,
							leave_type : doc.leave_type,
							date_requested_str :  doc.date_requested_str,
							date_requested :  doc.date_requested,														
							date_items : date_items
						});
						
					}
					
					
					var result = {
						success:true,
						result : data,
						total_docs : total_num_docs,
						next_page : next_page,
						numrows : numrows,
						numpages : numpages
					};
					return res.send(result, 200);

        	});
		});
		*/
	});
	

});


module.exports = router;