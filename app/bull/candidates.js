var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');


/**
 * MONGO MODELS
 */
var jobseekerSchema = require("../models/Jobseeker");


/**
 * MYSQL MODELS
 */
var solrCandidatesSchema = require("../mysql/SolrCandidates");
var personalInfoSchema = require("../mysql/Personal_Info");
var recruiterStaffSchema = require("../mysql/RecruiterStaff");
var currentjobSchema = require("../mysql/Currentjob");
var evaluationCommentsSchema = require("../mysql/EvaluationComments");
var skillsSchema = require("../mysql/Skill");
var educationSchema = require("../mysql/Education");
var unprocessedStaffSchema = require("../mysql/UnprocessedStaff");
var remoteReadyCriteriaEntrySumPointsSchema = require("../mysql/RemoteReadyCriteriaEntrySumPoints");
var remoteReadyEntriesSchema = require("../mysql/RemoteReadyEntries");
var preScreenedStaffSchema = require("../mysql/PreScreenStaff");
var jobSubCategoryApplicantsSchema = require("../mysql/JobSubCategoryApplicants");
var tbShortlistHistorySchema = require("../mysql/ShortlistHistory");
var tbEndorsementHistorySchema = require("../mysql/EndorsementHistory");
var tbRequestForInterviewSchema = require("../mysql/InterviewHistory");
var inactiveStaffSchema = require("../mysql/InactiveHistory");
var staffTimezoneSchema = require("../mysql/StaffTimezone");
var activateEntrySchema = require("../mysql/ActivateEntry");




var mongoCredentials = configs.getMongoCredentials();


var fileSyncDefer = Q.defer();
var fileSyncPromise = fileSyncDefer.promise;

module.exports = {
    fileSyncPromise: fileSyncPromise,
    processCandidateFiles:function(job, done){
        var candidate = job.data.processCandidate;

        if(isNaN(candidate.id) || !candidate.id || candidate.id == ""){
            console.log("candidate.id must be a valid number");
            done();
            return true;
        }



        function delay() {
            return Q.delay(100);
        }


        var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
        //var prod_db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port +  "/prod");

        var candidatesFileUploadsSchema = require("../models/CandidatesFileUploads");
        var CandidatesFileUploads = db.model("CandidatesFileUploads", candidatesFileUploadsSchema);


        var applicantFilesSchema = require("../mysql/ApplicantFile");

        var id = candidate.id;


        var candidate_details_promises = [];

        var syncImagedeffered = Q.defer();
        var syncImagepromise = syncImagedeffered.promise;
        candidate_details_promises.push(syncImagepromise);
        candidate_details_promises.push(delay);

        var syncVoicedeffered = Q.defer();
        var syncVoicepromise = syncVoicedeffered.promise;
        candidate_details_promises.push(syncVoicepromise);
        candidate_details_promises.push(delay);


        var syncApplicantFilesdeffered = Q.defer();
        var syncApplicantFilespromise = syncApplicantFilesdeffered.promise;
        candidate_details_promises.push(syncApplicantFilespromise);
        candidate_details_promises.push(delay);


        //get jobseeker image
        personalInfoSchema.getImageFile(parseInt(id)).then(function(result){
            if(result.success){
                CandidatesFileUploads.findOne({userid:parseInt(id), file_type: "IMAGE"}).exec(function(err, existingRecord){
                    var new_grid_fs = new CandidatesFileUploads();
                    if(existingRecord){
                        console.log("record found! IMAGE");
                        new_grid_fs = existingRecord;
                    }

                    try{
                        new_grid_fs.saveFile(result, id + "." + result.ext, "", {id: id}, "IMAGE").then(function(gridSaveResult){

                            syncImagedeffered.resolve(gridSaveResult);
                        });
                    } catch(error){
                        console.log("Error saving Image to candidates_file_uploads");
                        console.log(error);
                        syncImagedeffered.resolve(error);
                    }

                });
            } else{
                console.log("NO IMAGE file to upload");
                syncImagedeffered.resolve(false);
            }
        });


        //get jobseeker voice
        personalInfoSchema.getVoiceFile(parseInt(id)).then(function(result){
            if(result.success){
                CandidatesFileUploads.findOne({userid:parseInt(id), file_type: "AUDIO"}).exec(function(err, existingRecord){
                    var new_grid_fs = new CandidatesFileUploads();
                    if(existingRecord){
                        console.log("record found! AUDIO");
                        new_grid_fs = existingRecord;
                    }

                    try{
                        new_grid_fs.saveFile(result, id + "." + result.ext, "", {id: id}, "AUDIO").then(function(gridSaveResult){

                            console.log(gridSaveResult);
                            syncVoicedeffered.resolve(gridSaveResult);
                        });
                    } catch(error){
                        console.log("Error uploading AUDIO to candidates_file_uploads");
                        console.log(error);
                        syncVoicedeffered.resolve(error);
                    }

                });
            } else{
                console.log("NO AUDIO to upload");
                syncVoicedeffered.resolve(false);
            }
        });


        //get jobseeker applicant files
        applicantFilesSchema.getActualFiles(parseInt(id)).then(function(results){

            var all_syncing_promises_files = [];

            function syncFileToGridFs(i){
                var syncFileDeferred = Q.defer();
                var syncFilePromise = syncFileDeferred.promise;

                var current_file = results[i];

                CandidatesFileUploads.findOne({userid:parseInt(id), filename: current_file.filename}).exec(function(err, existingRecord){
                    var new_grid_fs = new CandidatesFileUploads();
                    if(existingRecord){
                        console.log("record found!" + current_file.file_type);
                        new_grid_fs = existingRecord;
                    }

                    try{
                        new_grid_fs.saveFile(current_file, current_file.filename, "", {id: id}, current_file.file_type).then(function(gridSaveResult){

                            console.log(gridSaveResult);
                            syncFileDeferred.resolve(gridSaveResult);
                        });
                    } catch(error){
                        console.log(error);
                        syncFileDeferred.resolve(error);
                    }

                });


                return syncFilePromise;
            }


            for(var i = 0;i < results.length;i++){
                all_syncing_promises_files.push(syncFileToGridFs(i));
                all_syncing_promises_files.push(delay);
            }


            var allPromise = Q.allSettled(all_syncing_promises_files);
            allPromise.then(function(results_syncing_files){
                console.log("applicant files defer resolved!");
                syncApplicantFilesdeffered.resolve(true);
            });
        });


        var allSyncPromise = Q.allSettled(candidate_details_promises);
        allSyncPromise.then(function (results) {
            try{
                var result_to_resolve = {success:true,result:results};
                console.log(job.data);
                fileSyncDefer.resolve(result_to_resolve);
                done();
            } catch(error){
                console.log(error);
            }

        });
    },
    processPerCandidate:function(job, done){
        try{

            function delay() {
                return Q.delay(100);
            }

            // Require module
            var SolrNode = require('solr-node');
            var configs = require("../config/configs");
            var env = require("../config/env");


            console.log("Processing per candidate "+job.data.processCandidate.id);



            var candidate = job.data.processCandidate;

            if(isNaN(candidate.id) || !candidate.id || candidate.id == ""){
                console.log("candidate.id must be a valid number");
                done();
                return true;
            }

            candidate.content = "";


            var options = {
                host: configs.getSolrCredentials()["host"],//'127.0.0.1',
                port: configs.getSolrCredentials()["port"],// '8983',
                core: 'candidates',
                protocol: 'http',
                debugLevel: 'ERROR' // log4js debug level paramter
            };

            // Create client
            var client = new SolrNode(options);


            try{
                var query = client.query().q({personal_userid:candidate.id});
            } catch(error){
                console.log(error);
                done();
            }



            var allFetchPromises = [];

            var jobseekerFetchDefer = Q.defer();
            var jobseekerFetchPromise = jobseekerFetchDefer.promise;
            allFetchPromises.push(jobseekerFetchPromise);
            allFetchPromises.push(delay);

            var progressFetchDefer = Q.defer();
            var progressFetchPromise = progressFetchDefer.promise;
            allFetchPromises.push(progressFetchPromise);
            allFetchPromises.push(delay);


            var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

            var Jobseeker = db.model("Jobseeker", jobseekerSchema);

            function extractContentFromCandidate(candidate){
                var content_to_save = [];

                //fetch content
                var object_keys = Object.keys(candidate);

                object_keys.forEach(function(value){
                    content_to_save.push(candidate[value]);
                });

                return content_to_save;
            }


            db.once('open', function () {
                var solrCandidateFetchDefer = Q.defer();
                var solrCandidateFetchPromise = solrCandidateFetchDefer.promise;

                if(typeof job.data.skip_lookup == "undefined"){
                    solrCandidatesSchema.getSolrCandidateData(candidate.id).then(function(foundSolrData){
                        if(foundSolrData){
                            solrCandidateFetchDefer.resolve(false);
                            console.log("candidate already synced! " + candidate.id);
                            db.close();
                        } else{
                            solrCandidateFetchDefer.resolve(true);
                        }
                    });
                } else{
                    solrCandidateFetchDefer.resolve(true);
                }


                solrCandidateFetchPromise.then(function(will_sync){
                    if(will_sync){
                        Jobseeker.findOne({_id: candidate.id}).lean().exec(function(err, foundDoc){

                            jobseekerFetchDefer.resolve(true);

                            var all_progress_fetch_promises = [];

                            var candidateDataFetchMongoOrMysqlDefer = Q.defer();
                            var candidateDataFetchMongoOrMysqlPromise = candidateDataFetchMongoOrMysqlDefer.promise;

                            var personal_info_needed_by_profile_completion = {
                                image: null,
                                voice: null
                            };
                            var employment_history_needed_by_profile_completion = [];
                            var skills_needed_by_profile_completion = [];

                            if(foundDoc){
                                console.log("Update From Mongo");
                                personal_info_needed_by_profile_completion.image = foundDoc.image;
                                personal_info_needed_by_profile_completion.voice = foundDoc.voice;

                                candidate.email = foundDoc.email;
                                candidate.personal_userid = foundDoc._id;
                                candidate.personal_fname = foundDoc.first_name;
                                candidate.personal_lname = foundDoc.last_name;
                                candidate.personal_image = foundDoc.image;
                                candidate.personal_voice_path = foundDoc.voice;
                                candidate.personal_gender = foundDoc.gender;
                                candidate.personal_nationality = foundDoc.nationality;
                                candidate.personal_permanent_residence = foundDoc.permanent_residence;
                                candidate.personal_email = foundDoc.email;
                                candidate.personal_marital_status = foundDoc.marital_status;
                                candidate.personal_alt_email = foundDoc.alt_email;
                                candidate.personal_address1 = foundDoc.address;
                                candidate.personal_skype_id = foundDoc.skype_id;
                                candidate.personal_postcode = foundDoc.postcode;
                                candidate.personal_computer_hardware = "";
                                if(foundDoc.dateCreated){
                                    candidate.personal_datecreated = foundDoc.dateCreated;
                                }

                                if(foundDoc.dateUpdated){
                                    candidate.personal_dateupdated = foundDoc.dateUpdated;
                                }

                                if(foundDoc.computer_hardware){
                                    candidate.personal_computer_hardware = foundDoc.computer_hardware.trim();
                                }

                                if(foundDoc.education){
                                    candidate.education_educationallevel = foundDoc.education.educationallevel;
                                    candidate.education_fieldstudy = foundDoc.education.fieldstudy;
                                    candidate.education_major = foundDoc.education.major;
                                    candidate.education_college_name = foundDoc.education.college_name;
                                    candidate.education_college_country = foundDoc.education.college_country;
                                    candidate.education_trainings_seminars = foundDoc.education.trainings_seminars;
                                    candidate.education_licence_certification = foundDoc.education.licence_certification;
                                }
                                if(foundDoc.recruiter){
                                    candidate.recruiter_assigned_id = foundDoc.recruiter.id;
                                    candidate.recruiter_assigned_first_name = foundDoc.recruiter.first_name;
                                    candidate.recruiter_assigned_last_name = foundDoc.recruiter.last_name;
                                    candidate.recruiter_assigned_full_name = foundDoc.recruiter.first_name + " " + foundDoc.recruiter.last_name;
                                }

                                var temp_availability = [];
                                candidate.categorized_work_availability = "";

                                if(foundDoc.available_full_time){
                                    temp_availability.push("Full Time");
                                }

                                if(foundDoc.available_part_time){
                                    temp_availability.push("Part Time");
                                }

                                candidate.categorized_work_availability = temp_availability.join("/");

                                candidate.currentjob_latest_job_title = foundDoc.latest_job_title;

                                var content_to_save = extractContentFromCandidate(candidate);

                                if(foundDoc.skills){
                                    candidate.skills = [];
                                    for(var i = 0;i < foundDoc.skills.length;i++){
                                        skills_needed_by_profile_completion.push(foundDoc.skills[i]);
                                        candidate.skills.push(foundDoc.skills[i]["skill"]);
                                        content_to_save.push(foundDoc.skills[i]["skill"]);
                                    }
                                }

                                if(foundDoc.evaluation_comments){
                                    candidate.evaluation_notes = [];
                                    for(var i = 0;i < foundDoc.evaluation_comments.length;i++){
                                        candidate.evaluation_notes.push(foundDoc.evaluation_comments[i]["comments"]);
                                        content_to_save.push(foundDoc.evaluation_comments[i]["comments"]);
                                    }
                                }

                                if(foundDoc.employment_history){
                                    for(var i = 0;i < foundDoc.employment_history.length;i++){
                                        if(i < 10){
                                            var current_item = foundDoc.employment_history[i];
                                            employment_history_needed_by_profile_completion.push(current_item);

                                            if(i == 0){
                                                candidate["currentjob_companyname"] = current_item.companyName;
                                                candidate["currentjob_position"] = current_item.position;
                                                candidate["currentjob_duties"] = current_item.duties;
                                            } else{
                                                candidate["currentjob_companyname" + (i + 1)] = current_item.companyName;
                                                candidate["currentjob_position" + (i + 1)] = current_item.position;
                                                candidate["currentjob_duties" + (i + 1)] = current_item.duties;
                                            }
                                            content_to_save.push(current_item.companyName);
                                            content_to_save.push(current_item.position);
                                            content_to_save.push(current_item.duties);
                                        }
                                    }
                                }

                                candidate.content = content_to_save.join(" ");

                                candidateDataFetchMongoOrMysqlDefer.resolve(true);

                                db.close();

                            } else{
                                console.log("Update From Mysql");

                                var personalFetchDefer = Q.defer();
                                var personalFetchPromise = personalFetchDefer.promise;
                                all_progress_fetch_promises.push(personalFetchPromise);
                                all_progress_fetch_promises.push(delay);

                                var contentJoinDefer = Q.defer();
                                var contentJoinPromise = contentJoinDefer.promise;
                                all_progress_fetch_promises.push(contentJoinPromise);
                                all_progress_fetch_promises.push(delay);





                                var all_mysql_fetching = [];

                                var skillsFetchDefer = Q.defer();
                                var skillsFetchPromise = skillsFetchDefer.promise;
                                all_mysql_fetching.push(skillsFetchPromise);
                                all_mysql_fetching.push(delay);

                                var evaluationCommentsFetchDefer = Q.defer();
                                var evaluationCommentsFetchPromise = evaluationCommentsFetchDefer.promise;
                                all_mysql_fetching.push(evaluationCommentsFetchPromise);
                                all_mysql_fetching.push(delay);

                                var eduacationFetchDefer = Q.defer();
                                var educationFetchPromise = eduacationFetchDefer.promise;
                                all_mysql_fetching.push(educationFetchPromise);
                                all_mysql_fetching.push(delay);

                                var currentJobFetchDefer = Q.defer();
                                var currentJobFetchPromise = currentJobFetchDefer.promise;
                                all_mysql_fetching.push(currentJobFetchPromise);
                                all_mysql_fetching.push(delay);

                                var recruiterStaffFetchDefer = Q.defer();
                                var recruiterStaffFetchPromise = recruiterStaffFetchDefer.promise;
                                all_mysql_fetching.push(recruiterStaffFetchPromise);
                                all_mysql_fetching.push(delay);

                                var timezoneFetchDefer = Q.defer();
                                var timezoneFetchPromise = timezoneFetchDefer.promise;
                                all_mysql_fetching.push(timezoneFetchPromise);
                                all_mysql_fetching.push(delay);


                                var skills_value = [];
                                var evaluation_comments_value = [];
                                var education_value = null;
                                var currentjob_value = null;
                                var recruiter_value = null;
                                var categorized_work_availability_value = "";


                                var content_to_save = [];

                                staffTimezoneSchema.getStaffTimeZoneModel(candidate.id).then(function (foundStaffTimezone) {
                                    if (foundStaffTimezone) {

                                        var temp_availability = [];

                                        if (foundStaffTimezone.time_zone != null && foundStaffTimezone.time_zone != "") {

                                            temp_availability.push("Full Time");
                                        }

                                        if (foundStaffTimezone.p_timezone != null && foundStaffTimezone.p_timezone != "") {
                                            temp_availability.push("Part Time");

                                        }
                                        categorized_work_availability_value = temp_availability.join("/");
                                    }

                                    // console.log("timezone resolved");
                                    timezoneFetchDefer.resolve(true);
                                });


                                personalInfoSchema.getPersonalInfo(candidate.id, true).then(function (foundDoc) {
                                    if(foundDoc){

                                        personal_info_needed_by_profile_completion.image = foundDoc.image;
                                        personal_info_needed_by_profile_completion.voice = foundDoc.voice_path;

                                        candidate.email = foundDoc.email;
                                        candidate.personal_userid = foundDoc.dataValues.userid;
                                        candidate.personal_fname = foundDoc.fname;
                                        candidate.personal_lname = foundDoc.lname;
                                        candidate.personal_image = foundDoc.image;
                                        candidate.personal_voice_path = foundDoc.voice_path;
                                        candidate.personal_gender = foundDoc.gender;
                                        candidate.personal_nationality = foundDoc.nationality;
                                        candidate.personal_permanent_residence = foundDoc.permanent_residence;
                                        candidate.personal_email = foundDoc.email;
                                        candidate.personal_marital_status = foundDoc.marital_status;
                                        candidate.personal_alt_email = foundDoc.alt_email;
                                        candidate.personal_address1 = foundDoc.address;
                                        candidate.personal_skype_id = foundDoc.skype_id;
                                        candidate.personal_postcode = foundDoc.postcode;
                                        candidate.personal_computer_hardware = "";
                                        if(foundDoc.datecreated){
                                            candidate.personal_datecreated = foundDoc.datecreated;
                                        }

                                        if(foundDoc.dateupdated){
                                            candidate.personal_dateupdated = moment(foundDoc.dateupdated).toDate();
                                        }

                                        if(foundDoc.computer_hardware){
                                            candidate.personal_computer_hardware = foundDoc.computer_hardware.trim();
                                        }

                                        content_to_save = extractContentFromCandidate(candidate);
                                    }



                                    // console.log("personal details fetched mysql");
                                    personalFetchDefer.resolve(true);
                                });


                                recruiterStaffSchema.getRecruiter(parseInt(candidate.id)).then(function(result){
                                    if(result){
                                        recruiter_value = {
                                            recruiter_assigned_id: parseInt(result.admin_id),
                                            recruiter_assigned_first_name: result.admin_fname,
                                            recruiter_assigned_last_name: result.admin_lname,
                                            recruiter_assigned_full_name: result.admin_fname + " " + result.admin_lname

                                        };
                                    }
                                    // console.log("recruiter fetched");
                                    recruiterStaffFetchDefer.resolve(true);
                                });



                                currentjobSchema.getCurrentJobInfo(candidate.id, [
                                    "latest_job_title",

                                    "companyname",
                                    "position",
                                    "duties",

                                    "monthfrom",
                                    "yearfrom",
                                    "monthto",
                                    "yearto",

                                    "companyname2",
                                    "position2",
                                    "duties2",

                                    "monthfrom2",
                                    "yearfrom2",
                                    "monthto2",
                                    "yearto2",

                                    "companyname3",
                                    "position3",
                                    "duties3",

                                    "monthfrom3",
                                    "yearfrom3",
                                    "monthto3",
                                    "yearto3",

                                    "companyname4",
                                    "position4",
                                    "duties4",

                                    "monthfrom4",
                                    "yearfrom4",
                                    "monthto4",
                                    "yearto4",

                                    "companyname5",
                                    "position5",
                                    "duties5",

                                    "monthfrom5",
                                    "yearfrom5",
                                    "monthto5",
                                    "yearto5",

                                    "companyname6",
                                    "position6",
                                    "duties6",

                                    "monthfrom6",
                                    "yearfrom6",
                                    "monthto6",
                                    "yearto6",

                                    "companyname7",
                                    "position7",
                                    "duties7",

                                    "monthfrom7",
                                    "yearfrom7",
                                    "monthto7",
                                    "yearto7",

                                    "companyname8",
                                    "position8",
                                    "duties8",

                                    "monthfrom8",
                                    "yearfrom8",
                                    "monthto8",
                                    "yearto8",

                                    "companyname9",
                                    "position9",
                                    "duties9",

                                    "monthfrom9",
                                    "yearfrom9",
                                    "monthto9",
                                    "yearto9",

                                    "companyname10",
                                    "position10",
                                    "duties10",

                                    "monthfrom10",
                                    "yearfrom10",
                                    "monthto10",
                                    "yearto10",

                                ]).then(function(foundCurrentJob){
                                    if(foundCurrentJob){
                                        var employment_history_values = foundCurrentJob.dataValues;

                                        for(var i = 0;i < 10;i++){
                                            var temp_emp = {};
                                            if(i == 0){
                                                temp_emp.companyname = employment_history_values.companyname;
                                                temp_emp.position = employment_history_values.position;
                                                temp_emp.duties = employment_history_values.duties;
                                                temp_emp.monthfrom = employment_history_values.monthfrom;
                                                temp_emp.yearfrom = employment_history_values.yearfrom;
                                                temp_emp.monthto = employment_history_values.monthto;
                                                temp_emp.yearto = employment_history_values.yearto;

                                            } else{
                                                temp_emp.companyname = employment_history_values["companyname" + i];
                                                temp_emp.position = employment_history_values["position" + i];
                                                temp_emp.duties = employment_history_values["duties" + i];
                                                temp_emp.monthfrom = employment_history_values["monthfrom" + i];
                                                temp_emp.yearfrom = employment_history_values["yearfrom" + i];
                                                temp_emp.monthto = employment_history_values["monthto" + i];
                                                temp_emp.yearto = employment_history_values["yearto" + i];
                                            }

                                            if(temp_emp.companyname && temp_emp.companyname != ""){
                                                employment_history_needed_by_profile_completion.push(temp_emp);
                                            }
                                        }

                                        currentjob_value = foundCurrentJob.dataValues;
                                        delete currentjob_value.id;


                                        delete currentjob_value.monthfrom;
                                        delete currentjob_value.yearfrom;
                                        delete currentjob_value.monthto;
                                        delete currentjob_value.yearto;

                                        delete currentjob_value.monthfrom2;
                                        delete currentjob_value.yearfrom2;
                                        delete currentjob_value.monthto2;
                                        delete currentjob_value.yearto2;

                                        delete currentjob_value.monthfrom3;
                                        delete currentjob_value.yearfrom3;
                                        delete currentjob_value.monthto3;
                                        delete currentjob_value.yearto3;

                                        delete currentjob_value.monthfrom4;
                                        delete currentjob_value.yearfrom4;
                                        delete currentjob_value.monthto4;
                                        delete currentjob_value.yearto4;

                                        delete currentjob_value.monthfrom5;
                                        delete currentjob_value.yearfrom5;
                                        delete currentjob_value.monthto5;
                                        delete currentjob_value.yearto5;

                                        delete currentjob_value.monthfrom6;
                                        delete currentjob_value.yearfrom6;
                                        delete currentjob_value.monthto6;
                                        delete currentjob_value.yearto6;

                                        delete currentjob_value.monthfrom7;
                                        delete currentjob_value.yearfrom7;
                                        delete currentjob_value.monthto7;
                                        delete currentjob_value.yearto7;

                                        delete currentjob_value.monthfrom8;
                                        delete currentjob_value.yearfrom8;
                                        delete currentjob_value.monthto8;
                                        delete currentjob_value.yearto8;

                                        delete currentjob_value.monthfrom9;
                                        delete currentjob_value.yearfrom9;
                                        delete currentjob_value.monthto9;
                                        delete currentjob_value.yearto9;

                                        delete currentjob_value.monthfrom10;
                                        delete currentjob_value.yearfrom10;
                                        delete currentjob_value.monthto10;
                                        delete currentjob_value.yearto10;

                                    }
                                    // console.log("currentjob fetched mysql");
                                    currentJobFetchDefer.resolve(true);
                                });

                                skillsSchema.getSkills(candidate.id).then(function(foundSkills){
                                    if(foundSkills){
                                        for(var i = 0;i < foundSkills.length;i++){
                                            var current_item = foundSkills[i];
                                            skills_needed_by_profile_completion.push(current_item["dataValues"]);
                                            skills_value.push(current_item.skill);
                                        }
                                    }
                                    // console.log("skills fetched mysql");
                                    skillsFetchDefer.resolve(true);
                                });


                                evaluationCommentsSchema.getEvaluationComments(candidate.id).then(function(foundRecords){
                                    if(foundRecords){
                                        for(var i = 0;i < foundRecords.length;i++){
                                            var current_item = foundRecords[i];
                                            evaluation_comments_value.push(current_item.comments);
                                        }
                                    }
                                    // console.log("evaluation_comments fetched mysql");
                                    evaluationCommentsFetchDefer.resolve(true);
                                });


                                educationSchema.getEducationInfo(candidate.id, true).then(function(foundRecord){
                                    if(foundRecord){
                                        education_value = foundRecord.dataValues;
                                        delete education_value.grade;
                                        delete education_value.gpascore;
                                        delete education_value.graduate_month;
                                        delete education_value.graduate_year;
                                        delete education_value.userid;
                                        delete education_value.id;
                                    }
                                    // console.log("education fetched mysql");
                                    eduacationFetchDefer.resolve(true);
                                });



                                var allContentPromises = Q.allSettled(all_mysql_fetching);
                                allContentPromises.then(function (results) {
                                    // console.log("all myqsl data fetch for content!");

                                    if(recruiter_value){
                                        candidate.recruiter_assigned_id = recruiter_value.recruiter_assigned_id;
                                        candidate.recruiter_assigned_first_name = recruiter_value.recruiter_assigned_first_name;
                                        candidate.recruiter_assigned_last_name = recruiter_value.recruiter_assigned_last_name;
                                        candidate.recruiter_assigned_full_name = recruiter_value.recruiter_assigned_full_name;
                                    }

                                    candidate.categorized_work_availability = categorized_work_availability_value;

                                    if(currentjob_value){
                                        var currentjob_keys = Object.keys(currentjob_value);
                                        for(var i = 0;i < currentjob_keys.length;i++){
                                            var current_item = currentjob_value[currentjob_keys[i]];
                                            candidate["currentjob_" + currentjob_keys[i]] = current_item;
                                            content_to_save.push(current_item);
                                        }
                                    }



                                    if(skills_value.length > 0){
                                        candidate.skills = [];
                                        for(var i = 0;i < skills_value.length;i++){
                                            var current_item = skills_value[i];
                                            candidate.skills.push(current_item);
                                            content_to_save.push(current_item);
                                        }
                                    }

                                    if(evaluation_comments_value.length > 0){
                                        candidate.evaluation_notes = [];
                                        for(var i = 0;i < evaluation_comments_value.length;i++){
                                            var current_item = evaluation_comments_value[i];
                                            candidate.evaluation_notes.push(current_item);
                                            content_to_save.push(current_item);
                                        }
                                    }

                                    if(education_value){
                                        var educationKeys = Object.keys(education_value);
                                        for(var i = 0;i < educationKeys.length;i++){
                                            var current_item = education_value[educationKeys[i]];
                                            candidate["education_" + educationKeys[i]] = current_item;
                                            content_to_save.push(current_item);
                                        }
                                    }


                                    candidate.content = content_to_save.join(" ");


                                    contentJoinDefer.resolve(true);

                                    candidateDataFetchMongoOrMysqlDefer.resolve(true);


                                });
                            }

                            var unprocessFetchDefer = Q.defer();
                            var unprocessFetchPromise = unprocessFetchDefer.promise;
                            all_progress_fetch_promises.push(unprocessFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var remoteReadyFetchDefer = Q.defer();
                            var remoteReadyFetchPromise = remoteReadyFetchDefer.promise;
                            all_progress_fetch_promises.push(remoteReadyFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var prescreenFetchDefer = Q.defer();
                            var prescreenFetchPromise = prescreenFetchDefer.promise;
                            all_progress_fetch_promises.push(prescreenFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var categoriesFetchDefer = Q.defer();
                            var categoriesFetchPromise = categoriesFetchDefer.promise;
                            all_progress_fetch_promises.push(categoriesFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var shortlistFetchDefer = Q.defer();
                            var shorlistFetchPromise = shortlistFetchDefer.promise;
                            all_progress_fetch_promises.push(shorlistFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var endorsementFetchDefer = Q.defer();
                            var endorsementFetchPromise = endorsementFetchDefer.promise;
                            all_progress_fetch_promises.push(endorsementFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var interviewFetchDefer = Q.defer();
                            var interviewFetchPromise = interviewFetchDefer.promise;
                            all_progress_fetch_promises.push(interviewFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var inactiveFetchDefer = Q.defer();
                            var intactiveFetchPromise = inactiveFetchDefer.promise;
                            all_progress_fetch_promises.push(intactiveFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var activatedFetchDefer = Q.defer();
                            var activatedFetchPromise = activatedFetchDefer.promise;
                            all_progress_fetch_promises.push(activatedFetchPromise);
                            all_progress_fetch_promises.push(delay);

                            var unprocessedRecord = null;
                            var remoteReadyRecord = null;
                            var prescreenRecord = null;
                            var categoriesRecord = null;
                            var shortlistRecord = null;
                            var endorsementRecord = null;
                            var interviewRecord = null;
                            var inactiveRecord = null;

                            var activatedRecord = null;



                            //get progress
                            unprocessedStaffSchema.getUnprocessedData(candidate.id).then(function(result){
                                if(result){
                                    unprocessedRecord = result;
                                }
                                // console.log("unprocessd fetch done!");
                                unprocessFetchDefer.resolve(true);
                            });

                            candidateDataFetchMongoOrMysqlPromise.then(function(result){
                                var fields_needed_by_remote_ready = {
                                    id: candidate.id,
                                    email: candidate.email,
                                    image: personal_info_needed_by_profile_completion.image,
                                    voice: personal_info_needed_by_profile_completion.voice,
                                    skills: skills_needed_by_profile_completion,
                                    employment_history: employment_history_needed_by_profile_completion
                                };
                                remoteReadyCriteriaEntrySumPointsSchema.computeProfileCompletion(fields_needed_by_remote_ready).then(function(result){
                                    if(result){
                                        remoteReadyRecord = result;
                                    }
                                    remoteReadyFetchDefer.resolve(true);

                                });

                                // remoteReadyCriteriaEntrySumPointsSchema.getRemoteReadyData(candidate.id).then(function(result){
                                //     if(result){
                                //         remoteReadyRecord = result;
                                //     }
                                //     // remoteReadyEntriesSchema.getEntries(candidate.id).then(function(entries){
                                //     //     for(var i = 0;i < entries.length;i++){
                                //     //         console.log(entries[i]["dataValues"]);
                                //     //     }
                                //     // });
                                //     // console.log("remote_ready fetch done!");
                                //
                                //     // remoteReadyCriteriaEntrySumPointsSchema.computeProfileCompletion(candidate.id);
                                //     remoteReadyFetchDefer.resolve(true);
                                // });
                            });


                            preScreenedStaffSchema.getPrescreenData(candidate.id).then(function(result){
                                if(result){
                                    prescreenRecord = result;
                                }
                                // console.log("prescreen fetch done!");
                                prescreenFetchDefer.resolve(true);
                            });

                            jobSubCategoryApplicantsSchema.getCatgoriesData(candidate.id).then(function(result){
                                if(result){
                                    if(result.length > 0){
                                        categoriesRecord = result;
                                    }
                                }
                                // console.log("categories fetch done!");
                                categoriesFetchDefer.resolve(true);
                            });

                            tbShortlistHistorySchema.getShortlistData(candidate.id).then(function(result){
                                if(result){
                                    if(result.length > 0){
                                        shortlistRecord = result;
                                    }
                                }
                                // console.log("shortlist fetch done!");
                                shortlistFetchDefer.resolve(true);
                            });

                            tbEndorsementHistorySchema.getEndorsementData(candidate.id).then(function(result){
                                if(result){
                                    if(result.length > 0){
                                        endorsementRecord = result;
                                    }

                                }
                                // console.log("endorsement fetch done!");
                                endorsementFetchDefer.resolve(true);
                            });

                            tbRequestForInterviewSchema.getInterviewData(candidate.id).then(function(result){
                                if(result){
                                    if(result.length > 0){
                                        interviewRecord = result;
                                    }
                                }
                                // console.log("interview fetch done!");
                                interviewFetchDefer.resolve(true);
                            });

                            activateEntrySchema.getEntries({
                                candidate_id: candidate.id,
                                is_processed: false
                            }).then(function(results){
                                if(results.length > 0){
                                    activatedRecord = results;
                                }
                                activatedFetchDefer.resolve(true);
                            });


                            inactiveStaffSchema.getInactiveData(candidate.id).then(function(result){
                                if(result){
                                    if(result.length > 0){
                                        inactiveRecord = result;
                                    }

                                }
                                // console.log("inactive fetch done!");
                                inactiveFetchDefer.resolve(true);
                            });




                            var allProgressPromises = Q.allSettled(all_progress_fetch_promises);
                            allProgressPromises.then(function (results) {
                                console.log("all progress fetch done");
                                candidate.personal_profile_completion = 0;

                                var progress = [];

                                if(unprocessedRecord){
                                    progress = [];
                                    progress.push("unprocessed");
                                }

                                if(remoteReadyRecord){
                                    if(remoteReadyRecord.points >= 70){
                                        progress = [];
                                        progress.push("remote_ready");
                                    }

                                    candidate.personal_profile_completion = remoteReadyRecord.points;

                                    if(candidate.personal_profile_completion > 100){
                                        candidate.personal_profile_completion = 100;
                                    }

                                    if(candidate.personal_profile_completion < 0){
                                        candidate.personal_profile_completion = 0;
                                    }
                                }

                                if(prescreenRecord){
                                    progress = [];
                                    progress.push("prescreened");
                                }

                                var add_categorized_progress = true;
                                if(activatedRecord){
                                    if(activatedRecord.length > 0){
                                        add_categorized_progress = false;
                                    }
                                }


                                if(categoriesRecord){
                                    if(add_categorized_progress){
                                        progress = [];

                                        progress.push("categorized");

                                        //if categorized on ASL
                                        //categorized_on_asl
                                        candidate.categorized_on_asl = "no";
                                        candidate.categorized_sub_categories = [];

                                        if(categoriesRecord.length){
                                            for(var i = 0;i < categoriesRecord.length;i++){
                                                var current_item = categoriesRecord[i];
                                                if(current_item.dataValues.ratings == 0){
                                                    if(candidate.categorized_on_asl == "no"){
                                                        candidate.categorized_on_asl = "yes";
                                                    }
                                                }

                                                candidate.categorized_sub_categories.push(current_item.dataValues.sub_category_id);
                                                candidate.categorized_date_added_on_asl = moment(current_item.dataValues.sub_category_applicants_date_created).toDate();

                                            }
                                        }
                                    }

                                }

                                if(shortlistRecord){
                                    if(add_categorized_progress){
                                        progress.push("shortlisted");
                                    }

                                }

                                if(endorsementRecord){
                                    if(add_categorized_progress){
                                        progress.push("endorsed");
                                    }
                                }

                                if(interviewRecord){
                                    if(add_categorized_progress){
                                        progress.push("interviewed");
                                    }
                                }

                                if(inactiveRecord){
                                    progress = [];
                                    candidate.inactive_date = moment(inactiveRecord.date).toDate();
                                    progress.push("inactive");
                                }

                                candidate.candidate_progress = progress;


                                progressFetchDefer.resolve(true);
                            });

                        });
                    } else{
                        progressFetchDefer.resolve(false);
                    }
                });

            });



            progressFetchPromise.then(function (will_sync) {
                if(will_sync){

                    console.log("Fetch Promises done solr sync!");


                    function saveToSolr(retries){
                        console.log("saving retries: " + retries);
                        if(retries >= 10){
                            console.log("Failed to save after 10 attempts");
                            if(typeof job.data.skip_lookup == "undefined"){
                                solrCandidatesSchema.saveSolrCandidateData(candidate.id);
                            }
                            done();
                            return true;
                        }
                        //console.log(candidate);
                        // Update document to Solr server
                        client.update(candidate, function(err, result) {
                            if (err) {
                                console.log(err);
                            }

                            if(result){
                                console.log('Solr Save Response:', result.responseHeader);
                                if(result.responseHeader.status == 500 || result.responseHeader.status == 503){
                                    saveToSolr(++retries);
                                } else{
                                    if(typeof job.data.skip_lookup == "undefined"){
                                        solrCandidatesSchema.saveSolrCandidateData(candidate.id);
                                    }
                                    done();
                                }
                            }

                        });
                    }

                    saveToSolr(0);

                } else{
                    done();
                }


            });
        } catch(major_major_error){
            console.log("Major error happened");
            console.log(major_major_error);
            done();
        }
    }
}