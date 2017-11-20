var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var postingSchema = require("../mysql/Posting");
var leadSchema = require("../mysql/Lead_Info");

var sequelize = require("../mysql/sequelize");


var tbEndorsementHistorySchema = sequelize.define('tb_endorsement_history',{

    userid: {type: Sequelize.INTEGER},
    client_name: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    position: {type: Sequelize.STRING},
    job_category: {type: Sequelize.INTEGER},
    date_endoesed: {type: Sequelize.DATE},
    rejected: {type: Sequelize.BOOLEAN},
    rejected_by: {type: Sequelize.INTEGER},
    rejected_date: {type: Sequelize.DATE},
    rejection_feedback: {type: Sequelize.STRING},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getEndorsementData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbEndorsementHistorySchema.findAll({
                where:{
                    userid:userid
                },
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },
        getEndrosementHistory:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbEndorsementHistorySchema.findAll({
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
                order: "date_endoesed DESC"
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        }
    }
});

tbEndorsementHistorySchema.belongsTo(postingSchema, {foreignKey: "position"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();

module.exports = tbEndorsementHistorySchema;
