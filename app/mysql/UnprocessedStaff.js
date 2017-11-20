var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var unprocessedStaffSchema = sequelize.define('unprocessed_staff',{

    userid: {type: Sequelize.INTEGER},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getUnprocessedData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            unprocessedStaffSchema.find({
                where:{
                    userid:userid
                },
                order: "id DESC"
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
module.exports = unprocessedStaffSchema;
