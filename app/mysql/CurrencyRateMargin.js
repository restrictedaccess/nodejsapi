var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var sequelize = require("../mysql/sequelize");


var currencyRateMarginSchema = sequelize.define('currency_rate_margin',{

	id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
	admin_id: {type:Sequelize.INTEGER},
	currency: {type:Sequelize.STRING},
	rate: {type:Sequelize.DECIMAL(12, 2)},
	work_status: {type:Sequelize.STRING},	
	date_added: {type:Sequelize.DATE}	
},{
	freezeTableName : true,
	timestamps: false,
	classMethods:
	{
		//Insert Method here
		addCurrencyRateMargin:function(params){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
					
					
			currencyRateMarginSchema.create({
				admin_id: params.admin_id,
				currency: params.currency,
				rate: params.rate,
				date_added: timestamp,
				work_status: params.work_status,				

			}).then(function(data){

				if(!data){
					willFulfillDeferred.reject(false);
				}else{					
					willFulfillDeferred.resolve(true);
				}
			});

			return willFulfill;
		},
		
		getLatestCurrencyRateMargin:function(){
			
			function getRecord(currency, work_status){
								
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;
				
				var sql = "SELECT * FROM currency_rate_margin "
						+"WHERE currency='"+currency+"' "
						+"AND work_status ='"+work_status+"' "
						+"ORDER BY date_added DESC LIMIT 1;";
	
	
				sequelize.query(sql, { type: sequelize.QueryTypes.SELECT}).then(function(data) {
					//console.log(data[0]);
					willFulfillDeferred.resolve(data[0]);
				});
	
				return willFulfill;
			}	
			
			
			function getCurrencies(){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;
				
				
				var currencies = Array("AUD", "USD", "GBP");			
				var work_status = Array(
					"Full-Time Staff Salary PHP 20,000.00 and up", 
					"Full-Time Staff Salary PHP 19,999.99 and below",
					"Part-Time Staff Salary PHP 14,000.00 and up",
					"Part-Time Staff Salary PHP 13,999.99 and below"
				);
			
			
				for(var i=0; i<currencies.length;i++){
					for(var j=0; j<work_status.length;j++){
						var promise = getRecord(currencies[i], work_status[j]);
						
					}					
				}
			
				return willFulfill;
			}
			
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var promises = [];
			var items = [];
			var currencies = Array("AUD", "USD", "GBP");			
			var work_status = Array(
				"Full-Time Staff Salary PHP 20,000.00 and up", 
				"Full-Time Staff Salary PHP 19,999.99 and below",
				"Part-Time Staff Salary PHP 14,000.00 and up",
				"Part-Time Staff Salary PHP 13,999.99 and below"
			);
			
			for(var i=0; i<currencies.length;i++){
				for(var j=0; j<work_status.length;j++){
					var promise = getRecord(currencies[i], work_status[j]);
					promises.push(promise);
					function delay(){ return Q.delay(100); }
					promises.push(delay);
					promise.then(function(itemValue){
						items.push(itemValue);
					});	
				}					
			}
			
			Q.allSettled(promises).then(function(response){
				console.log("All settled promises");
				console.log(items);
				willFulfillDeferred.resolve(items);
			});
			
			return willFulfill;
		},
		
		getAllCurrencyRateMargin:function(){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var sql = "SELECT c.id, c.currency, c.rate, c.admin_id, c.date_added, a.admin_fname, a.admin_lname FROM currency_rate_margin c "
					+"JOIN admin a ON a.admin_id = c.admin_id "					
					+"ORDER BY date_added DESC;";


			sequelize.query(sql, { type: sequelize.QueryTypes.SELECT}).then(function(data) {				
				willFulfillDeferred.resolve(data);
			});

			return willFulfill;
		}
		
		
		
		//End Method
	}

});



//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = currencyRateMarginSchema;