var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var postingSchema = require("../mysql/Posting");
var leadSchema = require("../mysql/Lead_Info");

var sequelize = require("../mysql/sequelize");

var jobApplicationsSchema = sequelize.define('applicants',{

        posting_id: {type: Sequelize.INTEGER},
        userid: {type: Sequelize.INTEGER},
        status: {type: Sequelize.STRING},
        date_apply: {type: Sequelize.DATE},
        expired: {type: Sequelize.BOOLEAN},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {

            getActiveJobApplications:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                jobApplicationsSchema.findAll({
                    include: [
                        {
                            model: postingSchema,
                            required: false,
                            attributes:["jobposition"],
                            include: [{
                                model: leadSchema,
                                required: false,
                                attributes:["fname","lname", "id"],
                            }]
                        }
                    ],
                    where:
                    {
                        userid:userid,
                        expired:0,
                        status: {
                            $ne: "Sub-Contracted"
                        },
                        "$posting.status$": "ACTIVE"
                    }
                }).then(function(foundObjects){

                    willFulfillDeferred.resolve(foundObjects);
                });

                return willFulfill;

            },

        }

    });


jobApplicationsSchema.belongsTo(postingSchema, {foreignKey: "posting_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = jobApplicationsSchema;