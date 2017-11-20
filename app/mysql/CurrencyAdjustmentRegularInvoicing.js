var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var Admin_Info = require("../mysql/Admin_Info");
var moment = require('moment');
var moment_tz = require('moment-timezone');
var currencyAdjustmentsRegularHistorySchema = require("../models/CurrencyAdjustmentRegularInvoicingHistory");

var sequelize = require("../mysql/sequelize");

var CurrencyAdjustmentRegularInvoicing = sequelize.define('currency_adjustments_regular_invoicing',{
		admin_id: {type: Sequelize.INTEGER},
		currency: {type: Sequelize.STRING},
		rate: {type: Sequelize.FLOAT},
		effective_month: {type: Sequelize.INTEGER},
		effective_year: {type: Sequelize.INTEGER},		
		date_added: {type: Sequelize.DATE},
		date_updated: {type: Sequelize.DATE}

},{
	 freezeTableName : true,
	 timestamps: false,
	 classMethods:
	 {
	 	searchCurrencyByMonthYear:function(params){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;			
			CurrencyAdjustmentRegularInvoicing.findOne({
				attributes:['id'],
				where:{					
					currency: params.currency,					
					effective_month: params.effective_month,
					effective_year: params.effective_year, 
				}

			}).then(function(foundObject){
				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;
			
		},
		
	 	insertCurrency:function(params){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
				
			CurrencyAdjustmentRegularInvoicing.create({

				admin_id: params.admin_id,
				currency: params.currency,
				rate: params.rate,
				effective_month: params.effective_month,
				effective_year: params.effective_year,		
				date_added: timestamp,
				date_updated: timestamp

			}).then(function(data){
				//console.log(data);
				willFulfillDeferred.resolve(data);
			});

			return willFulfill;
		},
		
		updateCurrency:function(params ,id){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
			
			CurrencyAdjustmentRegularInvoicing.update({
				rate: params.rate,
				date_updated : timestamp
			},{
				where:{
					id: id
				}

			}).then(function(updatedData){
				willFulfillDeferred.resolve(updatedData);
			});

			return willFulfill;
		},
		getLatestCurrencyAdjustmentRate:function(){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			
			var currencies = ["AUD", "GBP", "USD"];
			var result=[];
			var promises = [];
			
			function getPerCurrency(doc){
				var deferredPromise = Q.defer();
				var promise = deferredPromise.promise;
				deferredPromise.resolve(doc);
				return promise;
			}
			
			
			for(var i=0; i<currencies.length; i++){
				var sql = "SELECT c.* ,  date(concat(effective_year,'-',effective_month,'-01'))as reference_date FROM  currency_adjustments_regular_invoicing c WHERE c.currency=? ORDER BY reference_date DESC LIMIT 1;";	    		
	    		sequelize.query(sql, { replacements: [currencies[i]], type: sequelize.QueryTypes.SELECT }).then(function(record){	    			
	    			//console.log(record[0]);
	    			//willFulfillDeferred.resolve(record[0]);
	    			//var currency_promise = getPerCurrency(record[0]);
					promises.push(record[0]);
	    			
	    		});	    		
			}
			
			Promise.all(promises).then(function(users) {
				console.log(users);
	            var userPromises = [];
	            for (var i = 0; i < users.length; i++) {
	                userPromises.push(users[i]);
	            }
	            //return Promise.all(userPromises);
	            willFulfillDeferred.resolve(Promise.all(userPromises));
	        });
			
			/*
			var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){
				console.log("All promises done!");
				console.log(results);
				willFulfillDeferred.resolve(results);				
				
			});
			*/
			/*
			var sql = "SELECT c.* ,  date(concat(effective_year,'-',effective_month,'-01'))as reference_date FROM  currency_adjustments_regular_invoicing c WHERE c.currency IN('AUD', 'GBP', 'USD') GROUP BY c.currency ORDER BY reference_date DESC;";	    		
    		sequelize.query(sql, { type: sequelize.QueryTypes.SELECT }).then(function(result){	    			
    			console.log(result);
    			willFulfillDeferred.resolve(result);
    		});
			*/
			
			return willFulfill;
		},
		
		getHistory:function(){
			var db_value = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/currency_adjustments");				
			try{
				CurrencyAdjustmentRegularInvoicingHistory = db_value.model("RunningBalance", currencyAdjustmentsRegularHistorySchema);
			}catch(e){
				CurrencyAdjustmentRegularInvoicingHistory = mongoose.model("RunningBalance", currencyAdjustmentsRegularHistorySchema);
			}
			
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			CurrencyAdjustmentRegularInvoicingHistory.find().sort({"date_added" : -1}).exec(function(err, docs){
				willFulfillDeferred.resolve(docs);
			});
			return willFulfill;
			
			
		},
		
		UpSert:function(params, admin){
			//TO DO
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
			
			
			var db_value = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/currency_adjustments");				
			try{
				CurrencyAdjustmentRegularInvoicingHistory = db_value.model("RunningBalance", currencyAdjustmentsRegularHistorySchema);
			}catch(e){
				CurrencyAdjustmentRegularInvoicingHistory = mongoose.model("RunningBalance", currencyAdjustmentsRegularHistorySchema);
			}
			
			//Check if existing
			CurrencyAdjustmentRegularInvoicing.findOne({
				attributes:['id', 'rate', 'effective_month', 'effective_year'],
				where:{					
					currency: params.currency,					
					effective_month: params.effective_month,
					effective_year: params.effective_year, 
				}

			}).then(function(foundObject){
				
				
				
				if(foundObject != null){
					//Update record
					console.log("Record found");
					//console.log(foundObject);
					
					CurrencyAdjustmentRegularInvoicing.update({
						rate: params.rate,
						date_updated : timestamp
					},{
						where:{
							id: foundObject.id
						}
		
					}).then(function(updatedData){
						var mongo_doc = new CurrencyAdjustmentRegularInvoicingHistory();
						mongo_doc.currency_adjustments_regular_invoicing_id = foundObject.id;
						mongo_doc.admin_id = params.admin_id;
						mongo_doc.admin = admin.admin_fname+" "+admin.admin_lname;
						mongo_doc.date_added = timestamp;
						mongo_doc.previous_rate = foundObject.rate;
						mongo_doc.current_rate = params.rate;
						mongo_doc.currency = params.currency;
						mongo_doc.history = "Admin "+admin.admin_fname+" "+admin.admin_lname+ " updated "+params.currency+" currency adjustment rate from "+foundObject.rate +" to "+params.rate+" for the month/year "+foundObject.effective_month+"/"+foundObject.effective_year; 
						mongo_doc.save(function(err){							
							console.info("history added");
						});
						console.log(updatedData);
						willFulfillDeferred.resolve("Updated record");
					});
					
				}else{
					//Insert new record
					CurrencyAdjustmentRegularInvoicing.create({
						admin_id: params.admin_id,
						currency: params.currency,
						rate: params.rate,
						effective_month: params.effective_month,
						effective_year: params.effective_year,		
						date_added: timestamp,
						date_updated: timestamp
		
					}).then(function(data){
						//console.log(data);
						var mongo_doc = new CurrencyAdjustmentRegularInvoicingHistory();
						mongo_doc.currency_adjustments_regular_invoicing_id = data.id;
						mongo_doc.admin_id = params.admin_id;
						mongo_doc.admin = admin.admin_fname+" "+admin.admin_lname;
						mongo_doc.date_added = timestamp;
						mongo_doc.previous_rate = null;
						mongo_doc.current_rate = params.rate;
						mongo_doc.currency = params.currency;
						mongo_doc.history = "Admin "+admin.admin_fname+" "+admin.admin_lname+ " added "+params.currency+" currency adjustment rate of "+ params.rate +" for the month/year of "+params.effective_month +"/"+params.effective_year;
						mongo_doc.save(function(err){							
							console.info("history added");
						});
						willFulfillDeferred.resolve("Saved new record");
					});
				}
				//willFulfillDeferred.resolve(foundObject);
				
			});
			return willFulfill;
		}
	 }	
});

CurrencyAdjustmentRegularInvoicing.belongsTo(Admin_Info, {foreignKey:"admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = CurrencyAdjustmentRegularInvoicing;