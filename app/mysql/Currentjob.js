var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var PreviousJobIndustries = require("../mysql/PreviousJobIndustries");
var PreviousJobSalaryGrades = require("../mysql/PreviousJobSalaryGrades");
var definedIndustriesSchema = require("../mysql/IndustryLookup");
var SubCategory = require("../mysql/SubCategory");


var sequelize = require("../mysql/sequelize");


var currentjobSchema = sequelize.define('currentjob', {

        latest_job_title: {type: Sequelize.STRING},
        available_status: {type: Sequelize.STRING},
        available_notice: {type: Sequelize.STRING},
        available_notice_duration: {type: Sequelize.STRING},
        aday: {type: Sequelize.STRING},
        amonth: {type: Sequelize.STRING},
        ayear: {type: Sequelize.STRING},
        years_worked: {type: Sequelize.STRING},

        position_first_choice: {type: Sequelize.STRING},
        position_second_choice: {type: Sequelize.STRING},
        position_third_choice: {type: Sequelize.STRING},

        position_first_choice_exp_num: {type: Sequelize.INTEGER},
        position_second_choice_exp_num: {type: Sequelize.INTEGER},
        position_third_choice_exp_num: {type: Sequelize.INTEGER},

        companyname: {type: Sequelize.STRING},
        position: {type: Sequelize.STRING},
        monthfrom: {type: Sequelize.STRING},
        yearfrom: {type: Sequelize.STRING},
        monthto: {type: Sequelize.STRING},
        yearto: {type: Sequelize.STRING},
        duties: {type: Sequelize.STRING},

        companyname2: {type: Sequelize.STRING},
        position2: {type: Sequelize.STRING},
        monthfrom2: {type: Sequelize.STRING},
        yearfrom2: {type: Sequelize.STRING},
        monthto2: {type: Sequelize.STRING},
        yearto2: {type: Sequelize.STRING},
        duties2: {type: Sequelize.STRING},

        companyname3: {type: Sequelize.STRING},
        position3: {type: Sequelize.STRING},
        monthfrom3: {type: Sequelize.STRING},
        yearfrom3: {type: Sequelize.STRING},
        monthto3: {type: Sequelize.STRING},
        yearto3: {type: Sequelize.STRING},
        duties3: {type: Sequelize.STRING},


        companyname4: {type: Sequelize.STRING},
        position4: {type: Sequelize.STRING},
        monthfrom4: {type: Sequelize.STRING},
        yearfrom4: {type: Sequelize.STRING},
        monthto4: {type: Sequelize.STRING},
        yearto4: {type: Sequelize.STRING},
        duties4: {type: Sequelize.STRING},


        companyname5: {type: Sequelize.STRING},
        position5: {type: Sequelize.STRING},
        monthfrom5: {type: Sequelize.STRING},
        yearfrom5: {type: Sequelize.STRING},
        monthto5: {type: Sequelize.STRING},
        yearto5: {type: Sequelize.STRING},
        duties5: {type: Sequelize.STRING},


        companyname6: {type: Sequelize.STRING},
        position6: {type: Sequelize.STRING},
        monthfrom6: {type: Sequelize.STRING},
        yearfrom6: {type: Sequelize.STRING},
        monthto6: {type: Sequelize.STRING},
        yearto6: {type: Sequelize.STRING},
        duties6: {type: Sequelize.STRING},


        companyname7: {type: Sequelize.STRING},
        position7: {type: Sequelize.STRING},
        monthfrom7: {type: Sequelize.STRING},
        yearfrom7: {type: Sequelize.STRING},
        monthto7: {type: Sequelize.STRING},
        yearto7: {type: Sequelize.STRING},
        duties7: {type: Sequelize.STRING},


        companyname8: {type: Sequelize.STRING},
        position8: {type: Sequelize.STRING},
        monthfrom8: {type: Sequelize.STRING},
        yearfrom8: {type: Sequelize.STRING},
        monthto8: {type: Sequelize.STRING},
        yearto8: {type: Sequelize.STRING},
        duties8: {type: Sequelize.STRING},


        companyname9: {type: Sequelize.STRING},
        position9: {type: Sequelize.STRING},
        monthfrom9: {type: Sequelize.STRING},
        yearfrom9: {type: Sequelize.STRING},
        monthto9: {type: Sequelize.STRING},
        yearto9: {type: Sequelize.STRING},
        duties9: {type: Sequelize.STRING},


        companyname10: {type: Sequelize.STRING},
        position10: {type: Sequelize.STRING},
        monthfrom10: {type: Sequelize.STRING},
        yearfrom10: {type: Sequelize.STRING},
        monthto10: {type: Sequelize.STRING},
        yearto10: {type: Sequelize.STRING},
        duties10: {type: Sequelize.STRING},


    },
    {

        freezeTableName: true,
        timestamps: false,
        classMethods: {

            savePositionsDesired(data, userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                var data_to_save = {};


                if(data[0]){
                    var current_item = data[0];
                    data_to_save.position_first_choice = current_item.sub_category_id;
                    data_to_save.position_first_choice_exp_num = current_item.experience_in_years;
                } else{
                    data_to_save.position_first_choice = null;
                    data_to_save.position_first_choice_exp_num = null;
                }

                if(data[1]){
                    var current_item = data[1];
                    data_to_save.position_second_choice = current_item.sub_category_id;
                    data_to_save.position_second_choice_exp_num = current_item.experience_in_years;
                } else{
                    data_to_save.position_second_choice = null;
                    data_to_save.position_second_choice_exp_num = null;
                }


                if(data[2]){
                    var current_item = data[2];
                    data_to_save.position_third_choice = current_item.sub_category_id;
                    data_to_save.position_third_choice_exp_num = current_item.experience_in_years;
                } else{
                    data_to_save.position_third_choice = null;
                    data_to_save.position_third_choice_exp_num = null;
                }

                me.getCurrentJobInfo(userid, [
                    "id"
                ]).then(function(foundObject){
                    if(foundObject){
                        //update
                        currentjobSchema.update(data_to_save,{
                            where:{
                                id: foundObject.id
                            }
                        }).then(function(updatedData){
                            console.log("Positions Desired updated! " + foundObject.id);
                            willFulfillDeferred.resolve(true);
                        });
                    } else{
                        //insert
                        currentjobSchema.build(data_to_save).save().then(function(savedItem) {

                            console.log("Positions Desired inserted!");
                            willFulfillDeferred.resolve(true);
                        }).catch(function(error) {
                            console.log("error saving Positions Desired!");
                            console.log(error);
                            willFulfillDeferred.resolve(true);

                        });
                    }
                });



                return willFulfill;

            },

            fetchPositionDesired(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                var all_position_desired = [];

                me.getCurrentJobInfo(userid, [
                    "position_first_choice",
                    "position_second_choice",
                    "position_third_choice",

                    "position_first_choice_exp_num",
                    "position_second_choice_exp_num",
                    "position_third_choice_exp_num",
                ]).then(function(foundObject){
                    var allSubCategoryFetchPromises = [];

                    var first_choice = null;
                    var second_choice = null;
                    var third_choice = null;
                    if(foundObject){
                        if(foundObject.dataValues.position_first_choice && foundObject.dataValues.position_first_choice != ""){
                            var fetch_sub_promise = SubCategory.getSubCategory(foundObject.dataValues.position_first_choice);
                            allSubCategoryFetchPromises.push(fetch_sub_promise.then(function(foundSub){
                                var result = null;
                                if(foundSub){
                                    first_choice = {
                                        sub_category_id: parseInt(foundObject.dataValues.position_first_choice),
                                        position: foundSub.dataValues.sub_category_name,
                                        experience_in_years: foundObject.dataValues.position_first_choice_exp_num
                                    };
                                }

                            }));
                        }

                        if(foundObject.dataValues.position_second_choice && foundObject.dataValues.position_second_choice != ""){
                            var fetch_sub_promise = SubCategory.getSubCategory(foundObject.dataValues.position_second_choice);
                            allSubCategoryFetchPromises.push(fetch_sub_promise.then(function(foundSub){
                                var result = null;
                                if(foundSub){
                                    second_choice = {
                                        sub_category_id: parseInt(foundObject.dataValues.position_second_choice),
                                        position: foundSub.dataValues.sub_category_name,
                                        experience_in_years: foundObject.dataValues.position_second_choice_exp_num
                                    };
                                }

                            }));
                        }

                        if(foundObject.dataValues.position_third_choice && foundObject.dataValues.position_third_choice != ""){
                            var fetch_sub_promise = SubCategory.getSubCategory(foundObject.dataValues.position_third_choice);
                            allSubCategoryFetchPromises.push(fetch_sub_promise.then(function(foundSub){
                                var result = null;
                                if(foundSub){
                                    third_choice = {
                                        sub_category_id: parseInt(foundObject.dataValues.position_third_choice),
                                        position: foundSub.dataValues.sub_category_name,
                                        experience_in_years: foundObject.dataValues.position_third_choice_exp_num
                                    };
                                }

                            }));
                        }

                    }
                    Q.allSettled(allSubCategoryFetchPromises).then(function(result){
                        if(first_choice){
                            all_position_desired.push(first_choice);
                        }

                        if(second_choice){
                            all_position_desired.push(second_choice);
                        }

                        if(third_choice){
                            all_position_desired.push(third_choice);
                        }

                        willFulfillDeferred.resolve(all_position_desired);
                    });

                });

                return willFulfill;
            },

            saveData: function(data, userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                me.getCurrentJobInfo(userid).then(function(result){


                    if(result){
                        currentjobSchema.update(data,{
                            where:{
                                userid: userid
                            }
                        }).then(function(updatedData){
                            willFulfillDeferred.resolve(updatedData);
                        });
                    } else{
                        currentjobSchema.build(data).save().then(function(savedItem) {
                            willFulfillDeferred.resolve(savedItem);
                        }).catch(function(error) {
                            console.log(error);
                            willFulfillDeferred.resolve(error);
                        });
                    }
                });


                return willFulfill;
            },

            getCurrentJobInfo: function (userid, attributes) {
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var query = {
                    where: {
                        userid: userid
                    }
                };

                if(typeof attributes != "undefined"){
                    query.attributes = attributes
                }

                currentjobSchema.find(query).then(function (foundObject) {

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },

            batchSave: function (employment_history, userid) {
                function delay() {
                    return Q.delay(100);
                }

                var me = this;
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;
                var allSaveInsertPromises = [];

                var currentjob_to_save = {};

                var emp_history_limit = 10;


                currentjobSchema.find({
                    attributes: ['id'],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObject) {



                    var currenjob_related_indeces = [];

                    function savePreviousJobIndstries(current_item, current_index){
                        //update previous_job_industries
                        PreviousJobIndustries.find({
                            where:
                            {
                                userid:userid,
                                index: current_index
                            }
                        }).then(function(foundPreviousJobIndustries){
                            var previous_job_industry_data = {
                                industry_id: current_item["industry_id"],
                                index: current_index,
                                userid: userid,
                                work_setup_type: current_item["work_setup_type"]
                            };
                            if(foundPreviousJobIndustries){
                                PreviousJobIndustries.update(previous_job_industry_data,{
                                    where:{
                                        id: foundPreviousJobIndustries.dataValues.id
                                    }
                                }).then(function(updatedData){
                                });
                            } else{
                                previous_job_industry_data.date_created = configs.getDateToday();
                                PreviousJobIndustries.build(previous_job_industry_data).save().then(function(savedItem) {
                                }).catch(function(error) {
                                    console.log(error);

                                });
                            }
                        });
                    }

                    function savePreviousJobSalary(current_item, current_index){
                        //update previous_job_industries
                        PreviousJobSalaryGrades.find({
                            where:
                            {
                                userid:userid,
                                index: current_index
                            }
                        }).then(function(foundPreviousJobSalaryGrades){
                            var previous_job_industry_data = {
                                starting_grade: current_item["starting_grade"],
                                ending_grade: current_item["ending_grade"],
                                benefits: current_item["benefits"],
                                index: current_index,
                                userid: userid
                            };
                            if(foundPreviousJobSalaryGrades){
                                PreviousJobSalaryGrades.update(previous_job_industry_data,{
                                    where:{
                                        id: foundPreviousJobSalaryGrades.dataValues.id
                                    }
                                }).then(function(updatedData){
                                });
                            } else{
                                PreviousJobSalaryGrades.build(previous_job_industry_data).save().then(function(savedItem) {
                                }).catch(function(error) {
                                    console.log(error);

                                });
                            }
                        });
                    }

                    for (var i = 0; i < employment_history.length; i++) {
                        var current_item = employment_history[i];
                        // var monthfrom = moment(current_item.periodFrom).format("MMM");
                        // var yearfrom = moment(current_item.periodFrom).format("YYYY");

                        var monthfrom = current_item.monthfrom;
                        var yearfrom = current_item.yearfrom;

                        if(monthfrom){
                            monthfrom = monthfrom.toUpperCase();
                        }

                        // var monthto = current_item.periodTo;
                        // var yearto = current_item.periodTo;

                        var monthto = current_item.monthto;
                        var yearto = current_item.yearto;

                        if(monthto != "Present"){

                            // monthto = moment(current_item.periodTo).format("MMM");

                            // yearto = moment(current_item.periodTo).format("YYYY");


                            if(monthto){
                                monthto = monthto.toUpperCase();
                            }

                        } else{
                            monthto = "";
                        }

                        if (i == 0) {
                            currentjob_to_save["companyname"] = current_item["companyname"];
                            currentjob_to_save["position"] = current_item["position"];
                            currentjob_to_save["monthfrom"] = monthfrom;
                            currentjob_to_save["yearfrom"] = yearfrom;
                            currentjob_to_save["monthto"] = monthto;
                            currentjob_to_save["yearto"] = yearto;
                            if(current_item["duties"]){
                                currentjob_to_save["duties"] = current_item["duties"];
                            }

                        } else {
                            currentjob_to_save["companyname" + (i + 1)] = current_item["companyname"];
                            currentjob_to_save["position" + (i + 1)] = current_item["position"];
                            currentjob_to_save["monthfrom" + (i + 1)] = monthfrom;
                            currentjob_to_save["yearfrom" + (i + 1)] = yearfrom;
                            currentjob_to_save["monthto" + (i + 1)] = monthto;
                            currentjob_to_save["yearto" + (i + 1)] = yearto;
                            if(current_item["duties"]){
                                currentjob_to_save["duties" + (i + 1)] = current_item["duties"].trim();
                            }

                        }

                        var current_index = parseInt(parseInt(i) + 1);
                        savePreviousJobIndstries(current_item, current_index);
                        savePreviousJobSalary(current_item, current_index);

                    }


                    for (var i = employment_history.length; i < emp_history_limit; i++) {
                        if (i == 0) {
                            currentjob_to_save["companyname"] = "";
                            currentjob_to_save["position"] = "";
                            currentjob_to_save["monthfrom"] = "";
                            currentjob_to_save["yearfrom"] = "";
                            currentjob_to_save["monthto"] = "";
                            currentjob_to_save["yearto"] = "";
                            currentjob_to_save["duties"] = "";
                        } else {
                            currentjob_to_save["companyname" + (i + 1)] = "";
                            currentjob_to_save["position" + (i + 1)] = "";
                            currentjob_to_save["monthfrom" + (i + 1)] = "";
                            currentjob_to_save["yearfrom" + (i + 1)] = "";
                            currentjob_to_save["monthto" + (i + 1)] = "";
                            currentjob_to_save["yearto" + (i + 1)] = "";
                            currentjob_to_save["duties" + (i + 1)] = "";
                        }
                    }


                    if(foundObject){
                        //update
                        currentjobSchema.update(currentjob_to_save,{
                            where:{
                                id: foundObject.id
                            }
                        }).then(function(updatedData){
                            console.log("employment_history updated! " + foundObject.id);
                        });
                    } else{
                        //insert
                        currentjobSchema.build(currentjob_to_save).save().then(function(savedItem) {
                        }).catch(function(error) {
                            console.log("error saving Employment History!");
                            console.log(error);

                        });
                    }




                    willFulfillDeferred.resolve(me);
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

module.exports = currentjobSchema;