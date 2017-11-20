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

var Timesheet = require("../mysql/Timesheet");
var subcontractorsSchema = require("../models/Subcontractor");
var clientSchema = require("../models/Client");
var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");
var CurrencyAdjustmentRegularInvoicing = require("../mysql/CurrencyAdjustmentRegularInvoicing");
var timeRecordsSchema = require("../models/TimeRecords");
var timeRecordsDuplicateCheckerQueue = require("../bull/rssc_time_records_duplicate_checker");


var WORKING_WEEKDAYS = 22;
var pool = mysql.createPool({
	host : mysqlCredentials.host,
	user : mysqlCredentials.user,
	password : mysqlCredentials.password,
	database : mysqlCredentials.database
});

router.all("*", function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

/*
 *
 * */
router.all("/time-records-duplicate-checker", function(req, res, next){
	
	timeRecordsDuplicateCheckerQueue.add("rssc_time_records_duplicate_checker");
	//timeRecordsDuplicateCheckerQueue.add({couch_id : req.query.couch_id});
	return res.status(200).send({success:true});
	
});


/**
 * Remove Duplicates
 * @url http://test.njs_a.remotestaff.com.au/timesheet/remove-time-records-duplicates/
 */

router.all("/remove-time-records-duplicates", function(req, res, next){
	console.log("Test!!!");
	
	function getAllRsscTimeRecords(page){
		var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		var TimeRecords = db.model("TimeRecords", timeRecordsSchema);
		
		var deferredPromiseTimeRecords = Q.defer();
		var deferredPromiseTimeRecordsPromise = deferredPromiseTimeRecords.promise;
		var time_records=[];
		var promises = [];
		
		db.once('open', function(){
			if (typeof page=="undefined"){
				page = 1;
			}


			var time_records = [];
			var skips = (page-1) * 10000;

			TimeRecords.find()
				.skip(skips)
				.limit(300)
				.exec(function(err, docs){
					
					console.log("Page : " + page);
					
					function checkDuplicate(doc){
						var deferred_promise = Q.defer();
						var promise = deferred_promise.promise;
						TimeRecords.find({couch_id:doc.couch_id}).exec(function(err, rows){
							deferred_promise.resolve({count:rows.length, couch_id:doc.couch_id});
						});
						return promise;
					}
					
					if (!err)
					{
						var promises = [];
						var listTimeRecords = [];
						for(var i=0;i<docs.length;i++)
						{
							var doc = docs[i];
							//console.log("Checking couch_id : " + doc.couch_id);
							var promiseTimeRecord = checkDuplicate(doc);
							
							promiseTimeRecord.then(function(response){
								//console.log(response);
								if (response.count > 1){
									//console.log("Duplicate record found : " + response.couch_id);
									listTimeRecords.push(response.couch_id);
								}
							});
							promises.push(promiseTimeRecord);
									
						}
					}
					
					
					var allPromise = Q.all(promises);
					allPromise.then(function(results){
						console.log("All promises done for page " + page);							
						db.close();
						deferredPromiseTimeRecords.resolve({timerecords:docs.length, listTimeRecords:listTimeRecords});
	
					});
					
					
			});

		});

		return deferredPromiseTimeRecordsPromise;
	}


	var allTimeRecords = [];
	var deferredPromise = Q.defer();
	var promise = deferredPromise.promise;

	function recursiveTimeRecordsGet(page){
		console.log(page);
		getAllRsscTimeRecords(page).then(function(result){
			if (result.timerecords==0){
				deferredPromise.resolve(true);
			}else{
				//console.log(clients);
				for(var i=0;i<result.listTimeRecords.length;i++){
					allTimeRecords.push(result.listTimeRecords[i]);
				}
				recursiveTimeRecordsGet(page+1);
			}
		});
	}

	promise.then(()=>{
		console.log("Duplicate rssc time records : ");
		console.log(allTimeRecords);
		return res.status(200).send({success:true, records:allTimeRecords, total_docs:allTimeRecords.length}); 
	});
	
	recursiveTimeRecordsGet(1);
			
});


router.all("/currency-adjustments", function(req, res, next){
	//validate if client_id is passed
	if (!req.body.client_id) {

	}
	//validate if month_year is passed
	if (!req.body.month_year) {

	}

	var client_id = req.query.client_id;
	var month_year = req.query.month_year;
	var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	Date.prototype.toISODate = function() {
		var month = (this.getMonth() + 1);
		if (month + 1 <= 9) {
			month = "0" + month;
		}
		var date = this.getDate();
		if (date + 1 <= 9) {
			date = "0" + date;
		}
		return this.getFullYear() + "-" + month + "-" + date;
	};


	function getMonthDateRange(year, month) {
		var moment = require('moment');

		var startDate = moment([year, month]).add(-1,"month");
		var endDate = moment(startDate).endOf('month');
		console.log(startDate.toDate());
		console.log(endDate.toDate());
		return { start: startDate, end: endDate };
	}

	var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
	var Subcontractor = db.model("Subcontractor", subcontractorsSchema);
	var Client = db.model("Client", clientSchema);


	db.once("open", function() {
		pool.getConnection(function(err, connection) {


			Client.findOne({client_id:parseInt(client_id)}).exec(function(err, client){
				var selectedDate = new Date(month_year);

				CurrencyAdjustmentRegularInvoicing.findOne({
					where:{
						currency:client.currency,
						effective_month:selectedDate.getMonth()+1,
						effective_year:selectedDate.getFullYear()
					}
				}).then((forex_rate_value) => {
					if (forex_rate_value==null){
						return res.send({success:false, errors:"Missing Currency Adjustment Value for "+month_year});
					}else{
						var timesheet_date = new Date(month_year);
						var date_range = {start:moment(timesheet_date), end:moment(new Date(timesheet_date.getFullYear(), timesheet_date.getMonth()+1, 0))};
						
						var output_times = [];
						
						process_month(timesheet_date).then(function(){
							var build_outputs = [];
							for (var i = 0; i < output_times.length; i++) {
								build_outputs.push(output_times[i]);
							}
							db.close();
							var result = {
								success : true,
								result : build_outputs
							};
							
							return res.send(result, 200);	
						});


						function process_month(timesheet_date){
							var willFulfillDeferred = Q.defer();
							var willFulfill = willFulfillDeferred.promise;
							month_year = timesheet_date.toISODate();
							
							var sql = "SELECT t.id, t.month_year, t.userid, t.leads_id, t.subcontractors_id, p.fname, p.lname,s.job_designation, s.work_status, s.client_price, s.current_rate FROM timesheet AS t LEFT JOIN personal AS p ON t.userid = p.userid LEFT JOIN subcontractors as s ON t.subcontractors_id = s.id WHERE t.leads_id = ? AND month_year = ? AND t.status != 'deleted' ORDER BY p.fname, p.lname";
							
							connection.query({
								sql : sql,
								timeout : 40000,
								values : [parseInt(client_id), month_year]
							}, function(err, rows) {
								var promises = [];
								var timesheets = [];
								var outputs = [];
								var executed = 0;
								console.log("Loaded timesheet from MySQL");
								console.log("Count: "+rows.length);
								function search(row) {
									var promise_timesheet = Timesheet.findOne({
										where : {
											id : row.id
										}
									});
									promises.push(promise_timesheet);
									function delay() {
										return Q.delay(100);
									}

									//promises.push(delay);
									promise_timesheet.then(function(timesheet) {
										timesheet.row = row;
										timesheets.push(timesheet);
										executed++;
										return {
											timesheet : timesheet,
											status : "completed"
										};
									}).catch(function(err) {
										console.log(err);
									});
								};

								for (var i = 0; i < rows.length; i++) {
									search(rows[i]);
								}
								
								Q.allSettled(promises).then(function(){
									console.log("All Timesheet objects loaded");
									console.log(timesheets.length);
									var outputs = [];
									function getTimesheetSubconRelativeInfo(timesheet){
										console.log("Loading relevant info for timesheet "+timesheet.id)
										var deferredPromiseRelativeInfo = Q.defer();
										var promiseRelativeInfo = deferredPromiseRelativeInfo.promise;
										console.log("Loading subcon data "+timesheet.subcontractors_id)
										
										Subcontractor.findOne({
											subcontractors_id : parseInt(timesheet.subcontractors_id)
										}).exec(function(err, subcon){
											subcon.getCurrencyAdjustmentWithDate(timesheet, date_range, month_year).then(function(adjustments){
												//console.log("Resolved Adjustments received");
												//console.log(adjustments);
												for(var i=0;i<adjustments.length;i++){
													outputs.push(adjustments[i]);	
												}
												deferredPromiseRelativeInfo.resolve(true);
											});
										});
										return promiseRelativeInfo;
									}

									var relativePromises = [];
									for (var j = 0; j < timesheets.length; j++) {
										timesheet = timesheets[j];
										
										relativePromises.push(getTimesheetSubconRelativeInfo(timesheet));
									}


									Q.allSettled(relativePromises).then(function(){
										var result = {success:true, result:outputs};
										return res.status(200).send(result);
									});
								});

							});



							return willFulfill;
						}

					}
					
			
				});
			});
			
			
			

			console.log(client_id);

		});
	});
});

router.all("/currency-adjustments-2", function(req, res, next) {
	//validate if client_id is passed
	if (!req.body.client_id) {

	}
	//validate if month_year is passed
	if (!req.body.month_year) {

	}

	var client_id = req.query.client_id;
	var month_year = req.query.month_year;
	var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	Date.prototype.toISODate = function() {
		var month = (this.getMonth() + 1);
		if (month + 1 <= 9) {
			month = "0" + month;
		}
		var date = this.getDate();
		if (date + 1 <= 9) {
			date = "0" + date;
		}
		return this.getFullYear() + "-" + month + "-" + date;
	};


	var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
	var Subcontractor = db.model("Subcontractor", subcontractorsSchema);
	var Client = db.model("Client", clientSchema);


	db.once("open", function() {
		pool.getConnection(function(err, connection) {
			var timesheet_date = new Date(month_year);
			var output_times = [];

			process_month(timesheet_date).then(function(){
				var build_outputs = [];
				for (var i = 0; i < output_times.length; i++) {
					build_outputs.push(output_times[i]);
				}
				db.close();
				var result = {
					success : true,
					result : build_outputs
				};
				
				return res.send(result, 200);	
			});
			console.log(client_id);

			function process_month(month_year, date_range) {
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;
				month_year = month_year.toISODate();
				var sql = "SELECT t.id, t.month_year, t.userid, t.leads_id, t.subcontractors_id, p.fname, p.lname,s.job_designation, s.work_status, s.client_price, s.current_rate FROM timesheet AS t LEFT JOIN personal AS p ON t.userid = p.userid LEFT JOIN subcontractors as s ON t.subcontractors_id = s.id WHERE t.leads_id = ? AND month_year = ? AND t.status != 'deleted' ORDER BY p.fname, p.lname";
				console.log(month_year);
				connection.query({
					sql : sql,
					timeout : 40000,
					values : [parseInt(client_id), month_year]
				}, function(err, rows) {
					var promises = [];
					var timesheets = [];
					var outputs = [];
					var executed = 0;
					console.log("Result: ");
					console.log(err);


					function search(row) {
						var promise_timesheet = Timesheet.findOne({
							where : {
								id : row.id
							}
						});
						promises.push(promise_timesheet);
						function delay() {
							return Q.delay(100);
						}

						//promises.push(delay);
						promise_timesheet.then(function(timesheet) {
							timesheet.row = row;

							timesheets.push(timesheet);
							executed++;
							return {
								timesheet : timesheet,
								status : "completed"
							};
						}).catch(function(err) {
							console.log(err);
						});
					};

					function searchSubcon(row) {
						var deferredPromise = Q.defer();
						var promise = deferredPromise.promise;

						Subcontractor.findOne({
							subcontractors_id : parseInt(row.subcontractors_id)
						}).exec(function(err, subcon) {
							row.subcon = subcon;
							
							if (subcon==null){
								console.log("No Subcon!");
								
								Client.findOne({"client_doc.client_id":parseInt(row.leads_id)}).exec((err, client) => {
									row.currency = client.currency;
									CurrencyAdjustment.findOne({
										where:{
											active:"yes",
											currency:client.currency
										}
									}).then((forex_rate_value) => {
										row.forex_rate = forex_rate_value.rate;
										deferredPromise.resolve(subcon);	
									});
									
								});
								
								
							}else{
								subcon.getCurrencyAdjustment().then(function(currency_adjustment) {
									row.currency_adjustment = currency_adjustment;
									console.log(subcon.currency_adjustment);
									Client.findOne({"client_doc.client_id":parseInt(subcon.leads_detail.id)}).exec((err, client) => {
										row.currency = client.currency;
										CurrencyAdjustment.findOne({
											where:{
												active:"yes",
												currency:client.currency
											}
										}).then((forex_rate_value) => {
											row.forex_rate = forex_rate_value.rate;
											deferredPromise.resolve(subcon);

										});
									});

								});
							}
								
							
						});
						return promise;
					}

					for (var i = 0; i < rows.length; i++) {
						search(rows[i]);
						promises.push(searchSubcon(rows[i]));
					}
					Q.allSettled(promises).then(function() {
						var promise_total_promises = [];
						for (var j = 0; j < timesheets.length; j++) {
							timesheet = timesheets[j];
							//console.log(timesheet);
							var promise_totals = timesheet.getTotals();
							promise_total_promises.push(promise_totals);
							promise_totals.then(function(result) {
								//start calculation of timesheet
								var totals = result.totals;
								var timesheet = result.timesheet;
								var ts = result.timesheet.row;
								//console.log(ts);

								var hours_per_day = 8;
								if (ts.work_status == 'Part-Time') {
									hours_per_day = 4;
								}
								var currency_difference = Math.round((parseFloat(ts.current_rate) - ts.forex_rate) * 10000) / 10000;
								var total_hours = Math.round(WORKING_WEEKDAYS * hours_per_day * 100) / 100;
								var staff_hourly_rate = Math.round((ts.client_price * 12 / 52 / 5 / hours_per_day) * 100) / 100;

							
								console.log(description);
								var subcon_id = ts.subcontractors_id;
								var staff_name = ts.fname + " " + ts.lname;
								var job_designation = ts.job_designation;
								var qty = totals.sum_adj_hrs;
								var start_date = new Date(month_year);
								var end_date = new Date(start_date.getFullYear(), start_date.getMonth() + 1, 0);
								var item_type = "Currency Adjustment";
								var current_rate = ts.current_rate;
								var description = "Currency Adjustment (Contract Rate 1 " + ts.currency + " = " + ts.current_rate + " PESO VS Current Rate 1 " + ts.currency + " = " + ts.forex_rate + " PESO, Currency Difference of " + currency_difference + "  PESO for your staff " + ts.fname + " " + ts.lname + ")(Actual Working Hours of "+qty+" from "+moment(start_date).format("MMMM D, YYYY")+" to "+moment(end_date).format("MMMM D, YYYY")+")(Hourly Rate "+staff_hourly_rate+")/Current Rate "+ts.current_rate;
								var output = {
									total_hours : total_hours,
									staff_hourly_rate : staff_hourly_rate,
									description : description,
									staff_name : staff_name,
									job_designation : job_designation,
									start_date : start_date,
									end_date : end_date,
									qty : qty,
									subcontractors_id : subcon_id,
									item_type : item_type,
									current_rate : current_rate,
									currency_adjustment : ts.subcon.currency_adjustment
								};

								output_times.push(output);

							});
						}

						Q.all(promise_total_promises).then(function() {
							console.log(output_times);
							willFulfillDeferred.resolve(output_times);
						});


					});

				});
				return willFulfill;
			}

		});
	});

});

router.all("/invoice-items", function(req, res, next) {

	//validate if client_id is passed
	if (!req.body.client_id) {

	}
	//validate if month_year is passed
	if (!req.body.month_year) {

	}

	var client_id = req.query.client_id;
	var month_year = req.query.month_year;
	var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

	Date.prototype.toISODate = function() {
		var month = (this.getMonth() + 1);
		if (month + 1 <= 9) {
			month = "0" + month;
		}
		var date = this.getDate();
		if (date + 1 <= 9) {
			date = "0" + date;
		}
		return this.getFullYear() + "-" + month + "-" + date;
	};

	pool.getConnection(function(err, connection) {

		//declare objects handler
		var output_times = [];
		var output_adjs = [];

		//create month year objects, current month is for timesheet, previous month is for adjustment
		var timesheet_date_current = new Date(month_year);
		var timesheet_date_previous = new Date(timesheet_date_current.getFullYear(), timesheet_date_current.getMonth() - 1, 1);

		var promise_current = process_month_year(timesheet_date_current, "N");
		var promise_previous = process_month_year(timesheet_date_previous, "Y");

		Q.all([promise_current, promise_previous]).then(function() {
			//build output
			connection.end();
			var build_outputs = [];
			for (var i = 0; i < output_times.length; i++) {
				build_outputs.push(output_times[i]);
			}
			for (var i = 0; i < output_adjs.length; i++) {
				build_outputs.push(output_adjs[i]);
			}
			var result = {
				success : true,
				result : build_outputs
			};
			return res.send(result, 200);
		});

		function process_month_year(month_year, adj) {
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			month_year = month_year.toISODate();
			var sql = "SELECT t.id, t.month_year, t.userid, t.leads_id, t.subcontractors_id, p.fname, p.lname,s.job_designation, s.work_status, s.client_price, s.current_rate FROM timesheet AS t LEFT JOIN personal AS p ON t.userid = p.userid LEFT JOIN subcontractors as s ON t.subcontractors_id = s.id WHERE t.leads_id = ? AND month_year = ? AND t.status != 'deleted' ORDER BY p.fname, p.lname";
			connection.query({
				sql : sql,
				timeout : 40000,
				values : [client_id, month_year]
			}, function(err, rows) {
				var promises = [];
				var timesheets = [];
				var outputs = [];
				var executed = 0;

				function search(row) {
					var promise_timesheet = Timesheet.findOne({
						where : {
							id : row.id
						}
					});
					promises.push(promise_timesheet);
					function delay() {
						return Q.delay(100);
					}

					//promises.push(delay);
					promise_timesheet.then(function(timesheet) {
						timesheet.row = row;
						timesheets.push(timesheet);
						executed++;
						return {
							timesheet : timesheet,
							status : "completed"
						};
					}).catch(function(err) {
						console.log(err);
					});
				};

				for (var i = 0; i < rows.length; i++) {
					search(rows[i]);
				}
				Q.allSettled(promises).then(function() {
					var promise_total_promises = [];
					for (var j = 0; j < timesheets.length; j++) {
						timesheet = timesheets[j];
						//console.log(timesheet);
						var promise_totals = timesheet.getTotals();
						promise_totals.then(function(result) {

							//start calculation of timesheet
							var totals = result.totals;
							var timesheet = result.timesheet;
							var ts = result.timesheet.row;
							var hours_per_day = 8;
							if (ts.work_status == 'Part-Time') {
								hours_per_day = 4;
							}

							var total_hours = Math.round(WORKING_WEEKDAYS * hours_per_day * 100) / 100;
							var staff_hourly_rate = Math.round((ts.client_price * 12 / 52 / 5 / hours_per_day) * 100) / 100;
							var description = ts.fname + " " + ts.lname + " [" + ts.job_designation + "]";
							var subcon_id = ts.subcontractors_id;
							var staff_name = ts.fname + " " + ts.lname;
							var job_designation = ts.job_designation;
							var qty = totals.sum_hrs_charged_to_client;
							var start_date = new Date(month_year);
							var end_date = new Date(start_date.getFullYear(), start_date.getMonth() + 1, 0);
							var item_type = "Regular Rostered Hours";
							var current_rate = ts.current_rate;
							if (adj == "Y") {

								var sum_hrs_charged_to_client = totals.sum_hrs_charged_to_client;
								if (sum_hrs_charged_to_client == null) {
									sum_hrs_charged_to_client = 0;
								}
								var sum_adj_hrs = totals.sum_adj_hrs;
								if (sum_adj_hrs == null) {
									sum_adj_hrs = 0;
								}

								qty = sum_adj_hrs - sum_hrs_charged_to_client;
								if (qty < 0) {
									description += " (" + monthNames[start_date.getMonth()] + " Un-Used Hour) Adjustment Credit Memo";
									item_type = "Adjustment Credit Memo";
								} else {
									description += " (" + monthNames[start_date.getMonth()] + " Overtime) Adjustment Over Time Work";
									item_type = "Adjustment Over Time Work";
								}

							}

							//round of to 2 decimal
							qty = Math.round(qty * 100) / 100;
							var output = {
								total_hours : total_hours,
								staff_hourly_rate : staff_hourly_rate,
								description : description,
								staff_name : staff_name,
								job_designation : job_designation,
								start_date : start_date,
								end_date : end_date,
								qty : qty,
								subcontractors_id : subcon_id,
								item_type : item_type,
								current_rate : current_rate
							};

							if (adj == "N") {
								output_times.push(output);
							} else {
								output_adjs.push(output);
							}

						});
						promise_total_promises.push(promise_totals);
					}
					Q.all(promise_total_promises).then(function() {

						if (adj == "N") {
							willFulfillDeferred.resolve(output_times);
						} else {
							willFulfillDeferred.resolve(output_adjs);
						}

					});
				});

			});

			return willFulfill;
		}

	});

});

module.exports = router;
