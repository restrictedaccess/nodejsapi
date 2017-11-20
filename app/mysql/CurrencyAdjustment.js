var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var Admin_Info = require("../mysql/Admin_Info");

var sequelize = require("../mysql/sequelize");

var CurrencyAdjustment = sequelize.define('currency_adjustments', {

    currency: {type: Sequelize.STRING},
    rate: {type: Sequelize.FLOAT},
    effective_date: {type: Sequelize.DATE},
    active: {type: Sequelize.STRING},
    date_added: {type: Sequelize.DATE},
    admin_id: {type: Sequelize.INTEGER},

}, {
    freezeTableName: true,
    timestamps: false,
    classMethods: {
        saveData:function(data){

            var willDefer = Q.defer();
            var willFullfill = willDefer.promise;

            CurrencyAdjustment.build(data).save().then(function (savedItem) {
                willDefer.resolve({success: true});
                console.log("saved currency_adjustments!");
            }).catch(function (error) {
                willDefer.resolve({success: true});
                console.log("error saving currency_adjustments!");
                console.log(error);

            });

            return willFullfill;
        },
        updateDataByCurrency:function(currency, data){
            var willDefer = Q.defer();
            var willFullfill = willDefer.promise;


            CurrencyAdjustment.update(data, {
                where: {
                    currency: currency
                }
            }).then(function (updatedData) {
                willDefer.resolve({success: true});
                console.log("currency_adjustments updated! " + data.currency);
            });


            return willFullfill;
        }
    }
});

CurrencyAdjustment.belongsTo(Admin_Info, {foreignKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = CurrencyAdjustment;