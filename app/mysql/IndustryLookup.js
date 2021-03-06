var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var definedIndustriesSchema = sequelize.define('defined_industries',{

        value: {type: Sequelize.STRING},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {

            getDefinedIndustry:function(id){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                definedIndustriesSchema.find({
                    where:
                    {
                        id:id
                    }
                }).then(function(foundObject){

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;

            },

        }

    });




//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = definedIndustriesSchema;