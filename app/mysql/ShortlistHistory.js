var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var postingSchema = require("../mysql/Posting");
var leadSchema = require("../mysql/Lead_Info");

var sequelize = require("../mysql/sequelize");


var tbShortlistHistorySchema = sequelize.define('tb_shortlist_history',{

    userid: {type: Sequelize.INTEGER},
    position: {type: Sequelize.STRING},
    status: {type: Sequelize.STRING},
    date_listed: {type: Sequelize.DATE},
    rejected: {type: Sequelize.BOOLEAN},
    rejected_by: {type: Sequelize.INTEGER},
    date_rejected: {type: Sequelize.DATE},
    feedback: {type: Sequelize.STRING},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getShortlistData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbShortlistHistorySchema.findAll({
                where:{
                    userid:userid
                },
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },
        getShortlistHistory:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbShortlistHistorySchema.findAll({
                include: [
                    {
                        model: postingSchema,
                        attributes:["jobposition"],
                        include: [{
                            model: leadSchema,
                            required: true,
                            attributes:["fname","lname", "id"],
                        }]
                    }
                ],
                where:
                    {
                        userid:userid
                    },
                order: "date_listed DESC"
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        }
    }
});

tbShortlistHistorySchema.belongsTo(postingSchema, {foreignKey: "position"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = tbShortlistHistorySchema;
