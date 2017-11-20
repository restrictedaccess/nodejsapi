var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");


var currencySchema = sequelize.define('currency_rates',{

    currency : {type: Sequelize.STRING},
    currency_rate_in: {type: Sequelize.STRING},
    rate : {type: Sequelize.INTEGER}

},
{

     freezeTableName : true,
     timestamps: false,
     classMethods:
     {
       getCurrentCurrency:function()
       {
         var willFulfillDeferred = Q.defer();
 			   var willFulfill = willFulfillDeferred.promise;

         currencySchema.findAll({
           attributes:
   	 				['currency','currency_rate_in','rate'],

            where:
            {
                currency:{in:['AUD', 'USD', 'GBP']},
                currency_rate_in:{in:['PHP', 'INR']},
                currently_used:'Y'
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

 module.exports = currencySchema;
