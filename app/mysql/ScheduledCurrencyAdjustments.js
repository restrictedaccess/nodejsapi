var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var postingSchema = require("../mysql/Posting");
var leadSchema = require("../mysql/Lead_Info");

var sequelize = require("../mysql/sequelize");


var scheduledCurrencyAdjustmentsSchema = sequelize.define('scheduled_currency_adjustments',{

    admin_id: {type: Sequelize.INTEGER},
    currency: {type: Sequelize.STRING},
    rate: {type:Sequelize.DECIMAL(12, 2)},
    effective_date: {type: Sequelize.DATE},
    status: {type: Sequelize.STRING},
    date_added: {type: Sequelize.DATE},
    date_executed: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        removePending:function(currency){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;


            scheduledCurrencyAdjustmentsSchema.update({

                status: "deleted"
            },{

                where:{
                    status: "pending",
                    currency: currency
                }

            }).then(function(updatedData){
                willFulfillDeferred.resolve(updatedData);
            });


            return willFulfill;

        },
        saveData:function(data){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;



            scheduledCurrencyAdjustmentsSchema.build(data).save().then(function (savedItem) {
                willFulfillDeferred.resolve({success: true});
                console.log("saved scheduled_currency_adjustments!");
            }).catch(function (error) {
                willFulfillDeferred.resolve({success: true});
                console.log("error saving scheduled_currency_adjustments!");
                console.log(error);

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
module.exports = scheduledCurrencyAdjustmentsSchema;
