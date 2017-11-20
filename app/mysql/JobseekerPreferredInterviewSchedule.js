var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var moment = require('moment');

var sequelize = require("../mysql/sequelize");

var jobseekerPreferredInterviewScheduleSchema = sequelize.define('jobseeker_preferred_interview_schedules',{

        userid: {type: Sequelize.INTEGER},
        date_interview: {type: Sequelize.DATE},
        time_interview: {type: Sequelize.TIME},
        interview_type: {type: Sequelize.STRING},
        date_created: {type: Sequelize.DATE},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {
            getInterviewSchedulesToString:function(userid){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                me.getInterviewSchedules(userid).then(function(foundObjects){
                    var interview_schedule = "";
                    var date_interview_schedule = "";
                    var time_interview_schedule = "";
                    var preferred_method_interview = [];
                    try{
                        for(var i = 0;i < foundObjects.length;i++){
                            var interview = foundObjects[i];
                            date_interview_schedule = moment(interview["dataValues"]["date_interview"]).format("MMM DD YYYY");
                            time_interview_schedule = interview["dataValues"]["time_interview"];

                            if(interview["dataValues"]["interview_type"] == "phone"){
                                preferred_method_interview.push("mobile");
                            } else{
                                preferred_method_interview.push(interview["dataValues"]["interview_type"]);
                            }
                        }

                        interview_schedule = date_interview_schedule + " " + time_interview_schedule + " " + preferred_method_interview.join(",");

                    } catch(major_error){
                        console.log("wapackasdofkljasdlfkasdflaskdjf major error");
                        console.log(major_error);
                    }

                    willFulfillDeferred.resolve({success: true, str: interview_schedule, result: foundObjects});
                });

                return willFulfill;
            },

            getInterviewSchedules:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                jobseekerPreferredInterviewScheduleSchema.findAll({
                    where:
                    {
                        userid:userid
                    }
                }).then(function(foundObjects){

                    willFulfillDeferred.resolve(foundObjects);
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
module.exports = jobseekerPreferredInterviewScheduleSchema;