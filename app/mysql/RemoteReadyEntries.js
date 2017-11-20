var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var remoteReadyCriteriaSchema = require("../mysql/RemoteReadyCriteria");


var sequelize = require("../mysql/sequelize");


var remoteReadyEntriesSchema = sequelize.define('remote_ready_criteria_entries',{

    userid: {type: Sequelize.INTEGER},
    remote_ready_criteria_id: {type: Sequelize.INTEGER},
    date_created: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getEntries:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            remoteReadyEntriesSchema.findAll({
                include: [{model: remoteReadyCriteriaSchema, attributes:["points"]}],
                where:{
                    userid:userid
                },
            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
            });

            return willFulfill;

        }
    }
});



remoteReadyEntriesSchema.belongsTo(remoteReadyCriteriaSchema, {foreignKey: "remote_ready_criteria_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = remoteReadyEntriesSchema;
