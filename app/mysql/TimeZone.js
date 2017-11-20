var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var timezoneSchema = sequelize.define('timezone_lookup',{

	timezone: {type: Sequelize.STRING},


},{
	freezeTableName : true,
	 timestamps: false,
	 classMethods:{
	 	getTimezone:function(){

	 		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			timezoneSchema.findAll({

				attributes:[
					'timezone'
				]

			}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;

	 	}
	 }
});




//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = timezoneSchema;
