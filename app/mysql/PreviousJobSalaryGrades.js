var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var previousJobSalaryGradesSchema = sequelize.define('previous_job_salary_grades',{

        userid: {type: Sequelize.INTEGER},
        starting_grade: {type: Sequelize.STRING},
        ending_grade: {type: Sequelize.STRING},
        benefits: {type: Sequelize.STRING},
        index: {type: Sequelize.INTEGER},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {


            getPreviousJobSalaryGrades:function(userid){

                function delay(){ return Q.delay(100); }
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;


                previousJobSalaryGradesSchema.findAll({
                    where:
                    {
                        userid:userid
                    }
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
module.exports = previousJobSalaryGradesSchema;