var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var remoteReadyEntriesSchema = require("../mysql/RemoteReadyEntries");
var RemoteReadyCriteria = require("../mysql/RemoteReadyCriteria");
var ApplicantFile = require("../mysql/ApplicantFile");
var AssessmentResult = require("../mysql/AssessmentResult");

var sequelize = require("../mysql/sequelize");


var remoteReadyCriteriaEntrySumPointsSchema = sequelize.define('remote_ready_criteria_entry_sum_points',{

    userid: {type: Sequelize.INTEGER},
    points: {type: Sequelize.INTEGER},
    date_updated: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{

        computeProfileCompletion:function(candidate){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;
            /**
             * 1.) Remove all remote_ready_criteria_entries of candidate
             * 2.) Fetch fields related to remote_ready_criteria
             * 3.) Save entries to remote_ready_criteria_entries
             * 4.) Save total points to me
             */

            var userid = candidate.id;

            remoteReadyEntriesSchema.destroy({
                where:{
                    userid: userid,
                }

            }).then(function(deleteRecords){

                console.log("all previous remote ready entries deleted");

                var entries_to_save = [];

                function createEntry(entry_id){
                    var remote_ready_entry = {
                        userid: candidate.id,
                        remote_ready_criteria_id:entry_id,
                        date_created: configs.getDateToday()
                    };

                    //entries_to_save.push(remote_ready_entry);
                    return remote_ready_entry;

                }


                function saveEntry(i){
                    var saveDefer = Q.defer();
                    var savePromise = saveDefer.promise;

                    var current_item = entries_to_save[i];

                    Q.delay(10).then(function(){
                        remoteReadyEntriesSchema.build(current_item).save().then(function (savedItem) {
                            RemoteReadyCriteria.getCriteria(current_item.remote_ready_criteria_id).then(function(criteria){
                                if(criteria){
                                    entries_to_save[i]["points"] = criteria.points;
                                }
                                saveDefer.resolve(true);
                            });
                        }).catch(function (error) {
                            console.log(error);

                            saveDefer.resolve(true);
                        });

                    });



                    return savePromise;
                }



                //1. Photo : 25 Points
                if(candidate.image && candidate.image != ""){

                    entries_to_save.push(createEntry(1));
                }


                //2. Voice Recording : 25 Points
                if(candidate.voice && candidate.voice != ""){

                    entries_to_save.push(createEntry(2));
                }

                //4.Skills : 2 points per 5 items/skills indicated
                if(candidate.skills){
                    var value = candidate.skills.length / 5;

                    var intValue = Math.floor(value);

                    for(var i = 0;i < intValue;i++){

                        entries_to_save.push(createEntry(3));
                    }
                }

                for(var i = 0;i < candidate.employment_history.length;i++){
                    var current_emp = candidate.employment_history[i];
                    var isValid = true;

                    if(!current_emp.duties || current_emp.duties == ""){
                        isValid = false;
                    } else if(current_emp.duties.length < 700){
                        isValid = false;
                    }

                    // if(!current_emp.companyname || current_emp.companyname == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.position || current_emp.position == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.duties || current_emp.duties == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.monthfrom || current_emp.monthfrom == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.yearfrom || current_emp.yearfrom == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.monthto || current_emp.monthto == ""){
                    //     isValid = false;
                    // }else  if(!current_emp.yearto || current_emp.yearto == ""){
                    //     isValid = false;
                    // }

                    if(isValid){
                        entries_to_save.push(createEntry(4));
                    }

                }

                var all_mysql_fetch = [];


                var home_office_photo = null;

                var isp_photo = null;

                var tests_taken = null;


                var homeOfficeFetchDefer = Q.defer();
                all_mysql_fetch.push(homeOfficeFetchDefer.promise);

                var ispFetchDefer = Q.defer();
                all_mysql_fetch.push(ispFetchDefer.promise);


                var testsTakenFetchDefer = Q.defer();
                all_mysql_fetch.push(testsTakenFetchDefer.promise);


                Q.delay(10).then(function(){
                    //fetch home office photo
                    ApplicantFile.getFilesByFileDescription({
                        file_description:"HOME OFFICE PHOTO",
                        userid: userid
                    }, ["id"]).then(function(foundObjects){
                        home_office_photo = foundObjects;
                        homeOfficeFetchDefer.resolve(true);
                    });
                });


                Q.delay(10).then(function(){
                    //fetch home office photo
                    ApplicantFile.getFilesByFileDescription({
                            file_description:"INTERNET  SERVICE PROVIDER PHOTO",
                            userid: userid
                    }, ["id"]).then(function(foundObjects){
                        isp_photo = foundObjects;
                        ispFetchDefer.resolve(true);
                    });
                });

                Q.delay(10).then(function(){
                    //fetch tests taken
                    AssessmentResult.getAssessmentResuls(candidate.id, candidate.email).then(function(foundObjects){

                        tests_taken = foundObjects;
                        testsTakenFetchDefer.resolve(true);

                    });
                });

                Q.allSettled(all_mysql_fetch).then(function(results){
                    if(home_office_photo){
                        if(home_office_photo.length > 0){
                            entries_to_save.push(createEntry(5));
                        }
                    }

                    if(isp_photo){
                        if(isp_photo.length > 0){
                            entries_to_save.push(createEntry(7));
                        }
                    }

                    if(tests_taken){

                        for(var i = 0;i < tests_taken.length;i++){
                            var current_item = tests_taken[i]["dataValues"];
                            var isTyping = false;
                            var name = "";
                            if(current_item.assessment_list){
                                var typing = current_item["assessment_list"]["dataValues"]["assessment_title"];

                                if(typing.toLowerCase().search("typing") != -1){
                                    isTyping = true;
                                }
                            }


                            if(isTyping){
                                if(current_item.result_pct >= 40){
                                    entries_to_save.push(createEntry(6));
                                }
                            } else{
                                if(current_item.result_pct >= 65){
                                    entries_to_save.push(createEntry(6));
                                }
                            }
                        }

                    }


                    var all_save_promises = [];
                    console.log(entries_to_save);


                    for(var i = 0;i < entries_to_save.length;i++){

                        all_save_promises.push(saveEntry(i));
                    }

                    Q.allSettled(all_save_promises).then(function(results){
                        var summation = 0;

                        for(var i = 0;i < entries_to_save.length;i++){
                            var current_item = entries_to_save[i];

                            summation += parseInt(current_item.points);
                        }

                        var data_to_save = {
                            userid: candidate.id,
                            points: summation
                        };

                        me.saveData(data_to_save).then(function(result){
                            console.log(data_to_save);
                            willFulfillDeferred.resolve(data_to_save);
                        });
                    });
                });
            });




            return willFulfill;
        },

        saveData:function(data){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;

            me.getRemoteReadyData(data.userid).then(function (foundObject) {

                data.date_updated = configs.getDateToday();
                if (foundObject) {
                    me.update(data, {
                        where: {
                            id: foundObject.dataValues.id
                        }
                    }).then(function (updatedData) {
                        console.log("remote ready summary points updated! " + foundObject.dataValues.id);
                        willFulfillDeferred.resolve({success: true, result: {id: foundObject.dataValues.id}});
                    });

                } else {

                    me.build(data).save().then(function (savedItem) {
                        willFulfillDeferred.resolve({success:true, result: savedItem});
                        console.log("saved remote ready summary points !");
                    }).catch(function (error) {
                        willFulfillDeferred.resolve({success:false, error: error});
                        console.log("errorremote ready summary points !");
                        console.log(error);

                    });
                }

            });

            return willFulfill;
        },

        getRemoteReadyData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            remoteReadyCriteriaEntrySumPointsSchema.find({
                where:{
                    userid:userid
                },
                order: "id DESC"
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
module.exports = remoteReadyCriteriaEntrySumPointsSchema;
