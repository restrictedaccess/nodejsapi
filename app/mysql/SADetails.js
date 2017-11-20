
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var saDetails =  sequelize.define('service_agreement_details',{

    service_agreement_details_id : {type: Sequelize.INTEGER, primaryKey:true},
    service_agreement_id: {type: Sequelize.INTEGER},
    service_agreement_details : {type: Sequelize.TEXT},
    removed: {type: Sequelize.STRING}
},{
    freezeTableName : true,
    timestamps: false,
    classMethods:
    {
        getServiceAgreementDetails:function(sa_id){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            saDetails.findAll({

                where:
                {
                    service_agreement_id: sa_id
                },
                order: [
                    ['service_agreement_id', 'DESC']
                ]

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
module.exports = saDetails;
