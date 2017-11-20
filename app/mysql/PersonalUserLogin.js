var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");


var personalUserLoginSchema = sequelize.define('personal_user_logins',{

    userid: {type: Sequelize.INTEGER},
    last_login: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{

        getLastLogin:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            personalUserLoginSchema.find({
                where:
                {
                    userid:userid
                },
                order: [
                    ['last_login', 'DESC']
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
module.exports = personalUserLoginSchema;
