var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");


var jobSubCategoryApplicantHistorySchema = sequelize.define('job_sub_category_applicant_history',{

    candidate_id: {type: Sequelize.INTEGER},
    sub_category_id	: {type: Sequelize.INTEGER},
    recruiter_id: {type: Sequelize.INTEGER},
    is_visible: {type: Sequelize.INTEGER},
    date_time: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        saveHistory: function(data){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            data.date_time = configs.getDateToday();

            jobSubCategoryApplicantHistorySchema.build(data).save().then(function(savedItem) {
                console.log(data);
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                console.log("saved job sub category applicant history");
                willFulfillDeferred.resolve({success:true});
            }).catch(function(error) {
                console.log(error);
                willFulfillDeferred.resolve(null);

            });

            return willFulfill;
        },
        getHistories:function(where){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            jobSubCategoryApplicantHistorySchema.findAll({
                where:where,
                order: 'date_time DESC'
            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
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
module.exports = jobSubCategoryApplicantHistorySchema;
