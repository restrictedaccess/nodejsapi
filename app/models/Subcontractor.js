var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var invoiceSchema = require("../models/Invoice");
var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");
var CurrencyAdjustmentRegularInvoicing = require("../mysql/CurrencyAdjustmentRegularInvoicing");

var clientSchema = require("../models/Client");
var mysql = require("mysql");
var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var moment_range = require("moment-range");
moment_range.extendMoment(moment);

var WORKING_WEEKDAYS = 22;

var subcontractorSchema  = new Schema({
	subcontractors_id:Number,
	userid:Number,
	personal_detail:{
		fname:String,
		lname:String,
		email:String
	},
	subcontractors_detail:{
		client_price:Number,
		status:String,
		work_status:String,
		job_designation:String,
		current_rate:Number,
		client_change_rate:Array,
		starting_date:Date,
		posting_id:Number
	},
	leads_detail:{
		id:Number,
		fname:String,
		lname:String
	},
	service_agreement_details: {
		service_agreement_id: Number,
		service_agreement_status: String,
		service_agreement_date_created: Date
	},
}, {
	collection:"subcontractors_reporting"
});



subcontractorSchema.methods.getClientSettings = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var client_id = me.client_id
	console.log(client_id);

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var clientSchema = require("../models/Client");
	var Client = db.model("Client", clientSchema);

	db.once("open", function(){
		console.log({client_id:parseInt(client_id)});
		Client.findOne({"client_doc.client_id":parseInt(me.leads_detail.id)}).exec(function(err, result){
			if(err)
			{
				console.log(err);
			}
			
			
			me.client_setting = {currency : result.currency, apply_gst : result.apply_gst, days_before_suspension : result.client_doc.days_before_suspension};
			willFulfillDeferred.resolve(result);
		});
	});


	return willFulfill;

};


subcontractorSchema.methods.getHourlyRate = function(){
	var hour_per_day = 0;
	if (this.subcontractors_detail.work_status=="Part-Time"){
		hour_per_day = 4;
	}else{
		hour_per_day = 8;
	}
	return Math.round((this.subcontractors_detail.client_price*12)/52/5/hour_per_day * 100)/100;
};

subcontractorSchema.methods.getHourlyRateByPriceWorkStatus = function(client_price, work_status){
	var hour_per_day = 0;
	if (work_status=="Part-Time"){
		hour_per_day = 4;
	}else{
		hour_per_day = 8;
	}
	return Math.round((client_price*12)/52/5/hour_per_day * 100)/100;
};



subcontractorSchema.methods.getDailyRate = function(){
	return Math.round((this.subcontractors_detail.client_price*12)/52/5 * 100) /100;
};



subcontractorSchema.methods.getBasic = function(){
	var output = {
		subcontractors_id:this.subcontractors_id,
		fname:this.personal_detail.fname,
		lname:this.personal_detail.lname,
		job_designation:this.subcontractors_detail.job_designation,
		work_status:this.subcontractors_detail.work_status,
		hourly_rate:this.getHourlyRate(),
		current_rate:this.subcontractors_detail.current_rate
	};

	if (typeof this.currency_adjustment != "undefined"){
		output.currency_adjustment = this.currency_adjustment;
	}
	return output;

};


subcontractorSchema.methods.getCurrencyAdjustmentWithDate = function(timesheet, date_range, month_year){
	var deferred_promise = Q.defer();
	var promise = deferred_promise.promise;
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
	var clientSchema = require("../models/Client");
	var Client = db.model("Client", clientSchema);
	var me = this;
	var build_outputs = [];
	var current_rate = me.subcontractors_detail.current_rate;
	function compute(current_rate, forex_rate, hourly_rate){
		return Number((hourly_rate* (current_rate-forex_rate))/forex_rate);
	}


	var pool = mysql.createPool({
		host : mysqlCredentials.host,
		user : mysqlCredentials.user,
		password : mysqlCredentials.password,
		database : mysqlCredentials.database
	});


	function getMonthDateRange(year, month) {
		var moment = require('moment');

		var startDate = moment([year, month]).add(-1,"month");
		var endDate = moment(startDate).endOf('month');
		console.log(startDate.toDate());
		console.log(endDate.toDate());
		return { start: startDate, end: endDate };
	}

	Date.prototype.addDays = function(days) {
		var dat = new Date(this.valueOf())
		dat.setDate(dat.getDate() + days);
		return dat;
	}

	var getDates = function(startDate, endDate) {
		var dates = [],
			currentDate = startDate,
			addDays = function(days) {
				var date = new Date(this.valueOf());
				date.setDate(date.getDate() + days);
				return date;
			};
		while (currentDate <= endDate) {
			dates.push(currentDate);
			currentDate = addDays.call(currentDate, 1);
		}
		return dates;
	};

	db.once("open", function(){
		pool.getConnection(function(err, connection) {
			/**
			 * Get selected change of rate with timesheet
			 */
			function changeOfRateWithTimesheet(rate, timesheet){
				var temp_deferred_promise = Q.defer();
				var temp_promise = temp_deferred_promise.promise;
				var selectedDate = new Date(month_year);

				var sql = "SELECT SUM(adj_hrs) AS sum_adj_hrs FROM timesheet_details WHERE reference_date BETWEEN ? AND ? AND timesheet_id = ?";
				var outputs = [];
				connection.query({
					sql : sql,
					timeout : 40000,
					values : [rate.start_date, rate.end_date, timesheet.id]
				}, function(err, rows) {
					var totals = rows[0];
					var adj_hrs = totals.sum_adj_hrs;
					Client.findOne({"client_doc.client_id":parseInt(me.leads_detail.id)}).exec((err, client) => {
						if (err){
							throw err;
						}

						console.log({
							currency:client.currency,
							effective_month:selectedDate.getMonth()+1,
							effective_year:selectedDate.getFullYear()
						});
						CurrencyAdjustmentRegularInvoicing.findOne({
							where:{
								currency:client.currency,
								effective_month:selectedDate.getMonth()+1,
								effective_year:selectedDate.getFullYear()
							}
						}).then((forex_rate_value) => {
							var current_rate = me.subcontractors_detail.current_rate;
							
							console.log("Former rate time: "+rate.rate);
							console.log("Current Rate: "+current_rate);
							console.log("Forex Rate Value: "+forex_rate_value.rate);
							
							console.log("Rate object ");
							console.log(rate);

							var currency_adjustment = compute(current_rate, forex_rate_value.rate, me.getHourlyRateByPriceWorkStatus(rate.rate, rate.work_status));
							var currency_difference = Math.round((parseFloat(me.subcontractors_detail.current_rate) - forex_rate_value.rate) * 10000) / 10000;
							console.log("Currency Adjustment for Subcontractor "+timesheet.subcontractors_id+" "+currency_adjustment);
							var hours_per_day = 8;
							if (rate.work_status == 'Part-Time') {
								hours_per_day = 4;
							}
							var total_hours = Math.round(WORKING_WEEKDAYS * hours_per_day * 100) / 100;
							var staff_hourly_rate = Math.round((rate.rate * 12 / 52 / 5 / hours_per_day) * 100) / 100;

							var subcon_id = me.subcontractors_id;
							var staff_name = me.personal_detail.fname + " " + me.personal_detail.lname;
							var job_designation = me.subcontractors_detail.job_designation;
							var qty = totals.sum_adj_hrs;
							var start_date = moment(month_year).toDate();
							
							var end_date = moment(moment(start_date).format("YYYY-MM-")+moment(start_date).daysInMonth()).toDate();
							
							if (moment(moment(start_date).format("YYYY-MM-")+moment(start_date).daysInMonth()).isAfter(rate.end_date)){
								end_date = moment(rate.end_date).subtract(1, 'day').toDate();
							}

							if (moment(month_year).isBefore(rate.start_date)){
								start_date = rate.start_date;
							}
		
							var item_type = "Currency Adjustment";
							var description = "Currency Adjustment (Contract Rate 1 " + client.currency + " = " + current_rate + " PESO VS Current Rate 1 " + client.currency + " = " + forex_rate_value.rate + " PESO, Currency Difference of " + currency_difference + "  PESO for your staff " + staff_name + ")(Actual Working Hours of "+qty+" from "+moment(start_date).format("MMMM D, YYYY")+" to "+moment(end_date).format("MMMM D, YYYY")+")(Hourly Rate "+staff_hourly_rate+")/Current Rate "+forex_rate_value.rate;
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
								currency_adjustment : currency_adjustment,
								actual_rate:rate
							};
							
							temp_deferred_promise.resolve(output);

						});
					});
                    pool.end(function (err) {
                        // all connections in the pool have ended
                        if(err){
                            console.log("Error Closing mysql connection pool");
                            console.log(err);
                        }
                    });

				});
				return temp_promise;
			}



			function convertAsiaManila(date){
				var todayCon = moment_tz(date).tz("GMT");
				var atzCon = todayCon.clone().tz("Asia/Manila");
				return atzCon;
			}

			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();


			var selectedChangeOfRate = [];
			var promisesChangeOfRate = [];
			


			for(var i=0;i<me.subcontractors_detail.client_change_rate.length;i++){
				var client_change_rate = me.subcontractors_detail.client_change_rate[i];
				client_change_rate.rate = parseFloat(client_change_rate.rate);
				client_change_rate.start_date = new Date(client_change_rate.start_date);
				if (client_change_rate.end_date == null){
					client_change_rate.end_date = timestamp;
				}else{
					client_change_rate.end_date = moment(new Date(client_change_rate.end_date)).subtract(1, 'ms').toDate();
				}
				var client_change_rate_moment_range = moment().range(moment(client_change_rate.start_date), moment(client_change_rate.end_date));
				console.log("Getting client change rate")	
				console.log(client_change_rate);
				
				
				var datesTimesheet = getDates(convertAsiaManila(date_range.start.toDate()).toDate(), convertAsiaManila(date_range.end.toDate()).toDate() );
				var found = false;
				for(var k=0;k<datesTimesheet.length;k++){
					var momentDate = moment(datesTimesheet[k]);
					if (momentDate.within(client_change_rate_moment_range)){
						found = true;
						break;
					}
				}
				
				if (found){
					console.log("Date Range within");
					selectedChangeOfRate.push(client_change_rate);
				}else{
					console.log("Date Range outside");
				}
			}

			console.log("Displaying change of rate for subcontractor "+me.subcontractors_id);
			console.log(selectedChangeOfRate);
			
			if (selectedChangeOfRate.length > 0){
				for(var j=0;j<selectedChangeOfRate.length;j++){
					var promise_change_of_rate = changeOfRateWithTimesheet(selectedChangeOfRate[j], timesheet);
					promisesChangeOfRate.push(promise_change_of_rate);
					promise_change_of_rate.then(function(output){
						//console.log("Returned output");
						//console.log(output);
						build_outputs.push(output);
					});
				}

				Q.allSettled(promisesChangeOfRate).then(function(){
					console.log("All Promises on getting currency adjustment for subcontractor "+me.subcontractors_id+" has been resolved!");
					db.close();
					try{
						deferred_promise.resolve(build_outputs);
						
						//console.log(deferred_promise);
						//console.log("Resolved!");
					}catch(e){
						throw e;
					}


				});
			}else{
				db.close();
				deferred_promise.resolve(false);
			}



		});




	});
	return promise;
}


subcontractorSchema.methods.getCurrencyAdjustment = function(forex_rate){
	var deferred_promise = Q.defer();
	var promise = deferred_promise.promise;
	var current_rate = this.subcontractors_detail.current_rate;
	console.log("Current Rate: "+current_rate);
	var me = this;
	function compute(current_rate, forex_rate, hourly_rate){
		return Number((hourly_rate* (current_rate-forex_rate))/forex_rate);
	}
	var db;
	var Client;
	var clientSchema;
	if (this.db==null||typeof this.db == "undefined"){
		db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		clientSchema = require("../models/Client");
		Client = db.model("Client", clientSchema);

		db.once("open", function(){

			if (typeof forex_rate == "undefined"){
				var defer_currency = Q.defer();
				var promise_currency = defer_currency.promise;
				
				//console.log({client_id:parseInt(me.leads_detail.id)});
				Client.findOne({"client_doc.client_id":parseInt(me.leads_detail.id)}).exec((err, client) => {
					if (err){
						throw err;
					}
					CurrencyAdjustment.findOne({
						where:{
							active:"yes",
							currency:client.currency
						}
					}).then((forex_rate_value) => {
						db.close();
						var currency_adjustment = compute(current_rate, forex_rate_value.rate, me.getHourlyRate());
						me.currency_adjustment = currency_adjustment;
						deferred_promise.resolve(currency_adjustment);
					});
				});
				
			}else{
				setTimeout(function(){
					
					console.log(current_rate);
					db.close();
					me.currency_adjustment = compute(current_rate, forex_rate, me.getHourlyRate());
					deferred_promise.resolve(me.currency_adjustment);
				}, 100);

				
			}
		});
	}else{
		db = this.db;
		clientSchema = require("../models/Client");
		Client = db.model("Client", clientSchema);

		if (typeof forex_rate == "undefined"){
			var defer_currency = Q.defer();
			var promise_currency = defer_currency.promise;
			
			//console.log({client_id:parseInt(me.leads_detail.id)});
			console.log("Getting CA of "+me.subcontractors_id);
			
			Client.findOne({"client_doc.client_id":parseInt(me.leads_detail.id)}).exec((err, client) => {
				if (err){
					throw err;
				}

				CurrencyAdjustment.findOne({
					where:{
						active:"yes",
						currency:client.currency
					}
				}).then((forex_rate_value) => {
					var currency_adjustment = compute(current_rate, forex_rate_value.rate, me.getHourlyRate());
					me.currency_adjustment = currency_adjustment;
					deferred_promise.resolve(currency_adjustment);
				}).catch(function(error){
					console.error(error);
				});
			}).catch(function(error){
				console.error(error);
			});;
			
		}else{
			setTimeout(function(){
				
				console.log(current_rate);
				me.currency_adjustment = compute(current_rate, forex_rate, me.getHourlyRate());
				deferred_promise.resolve(me.currency_adjustment);
			}, 100);

			
		}
	}

	

	return promise;
};

module.exports = subcontractorSchema;