var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");


var currencyLookupSchema = sequelize.define('currency_lookup',{
	
		sign: {type: Sequelize.STRING}

},{
	
	 freezeTableName : true,
	 timestamps: false,
		 classMethods:
		 {
		 	getCurrencySign:function(code){
		 		var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;
				
		 		currencyLookupSchema.find({
		 			
		 			attributes:['sign'],
		 			where:
		 			{
		 				code: code
		 			}
		 		}).then(function(foundObject){
					
					willFulfillDeferred.resolve(foundObject);
				});
				
				return willFulfill;;
		 		
		 	}
		 }
	
});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();

module.exports = currencyLookupSchema;