/**
 * REQUIRES
 */
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var apiUrl = configs.getAPIURL();
var njsUrl = "http://127.0.0.1:3000";
http.post = require("http-post");
var moment = require('moment');
var moment_tz = require('moment-timezone');
var env = require("../config/env");
var fileType = require('file-type');


var jobseekerSchema = require("../models/Jobseeker");
var priceFullTimeSchema = require("../models/PriceFullTime");
var pricePartTimeSchema = require("../models/PricePartTime");
var syncedCandidateSchema = require("../models/SyncedCandidate");
var syncedStaffHistorySchema = require("../models/SyncedStaffHIstory");
var staffHistoryMongoSchema = require("../models/StaffHistory");
var aslCategorizationEntry = require("../models/AslCategorizationEntry");

var personalInfoSchema = require("../mysql/Personal_Info");
var recruiterStaffSchema = require("../mysql/RecruiterStaff");
var jobSubCategoryApplicantsSchema = require("../mysql/JobSubCategoryApplicants");
var currentjobSchema = require("../mysql/Currentjob");
var previousJobIndustriesSchema = require("../mysql/PreviousJobIndustries");
var previousJobSalaryGradesSchema = require("../mysql/PreviousJobSalaryGrades");
var evaluationCommentsSchema = require("../mysql/EvaluationComments");
var personalWorkingModelSchema = require("../mysql/PersonalWorkingModel");
var languagesSchema = require("../mysql/Language");
var skillsSchema = require("../mysql/Skill");
var staffTimezoneSchema = require("../mysql/StaffTimezone");
var staffRateSchema = require("../mysql/StaffRate");
var assessmentResultsSchema = require("../mysql/AssessmentResult");
var staffHistorySchema = require("../mysql/StaffHistory");
var adminInfoSchema = require("../mysql/Admin_Info");
var applicantFilesSchema = require("../mysql/ApplicantFile");
var educationSchema = require("../mysql/Education");
var personalUserLoginSchema = require("../mysql/PersonalUserLogin");
var staffSkypesSchema = require("../mysql/StaffSkypes");
var applicantHistorySchema = require("../mysql/ApplicantHistory");
var tbShortlistHistorySchema = require("../mysql/ShortlistHistory");
var tbEndrosementHistorySchema = require("../mysql/EndorsementHistory");
var tbRequestForInterviewSchema = require("../mysql/InterviewHistory");
var characterReferencesSchema = require("../mysql/CharacterReference");
var appAppointmentSchema = require("../mysql/AppAppointment");
var jobseekerPreferredInterviewScheduleSchema = require("../mysql/JobseekerPreferredInterviewSchedule");
var inactiveHistorySchema = require("../mysql/InactiveHistory");

var solrCandidatesSchema = require("../mysql/SolrCandidates");

var candidatesQueue = require("../bull/candidates_queue");

var multiProcessQueue = require("../bull/cluster_process");
var candidatesProcessDef = require("../bull/candidates");

var mongoCredentials = configs.getMongoCredentials();


router.all("*", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});


/*
 * Method for saving candidates details to mongo
 * @url http://test.njs.remotestaff.com.au/jobseeker/save/
 *
 */
router.post("/save", function (req, res, next) {
    if(typeof req.body.candidate == "undefined"){
        throw "candidate field is required!";
    }

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var Jobseeker = db.model("Jobseeker", jobseekerSchema);

    var candidate = req.body.candidate;
    var search_key = {"_id" : candidate._id};


    // candidate["_id"] = parseInt(candidate.userid);

    candidate["userid"] = parseInt(candidate._id);

    delete candidate["id"];

    candidate.dateUpdated = new Date();

    if(typeof candidate.dateCreated == "undefined"){
        candidate.dateCreated = new Date();
    }

    function updateMongoDoc(data, callback){
        Jobseeker.update(search_key, data, {upsert: true}, callback);
    }


    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    db.once('open', function(){
        Jobseeker.findOne(search_key).exec(function(err, foundDoc){
            if (err) {
                db.close();
                willFulfillDeferred.resolve(null);
                return res.status(200).send({success: false, error: err});
            }

            if(foundDoc){
                //update

                updateMongoDoc(candidate, function(err){
                    if(err){
                        willFulfillDeferred.resolve(null);
                        return res.status(200).send({success: false, error: err});
                    }
                    willFulfillDeferred.resolve(foundDoc);
                    res.status(200).send({success: true, result: candidate});
                });
            } else{
                //insert
                foundDoc = new Jobseeker(candidate);

                foundDoc.save(function(err){
                    if (err){
                        willFulfillDeferred.resolve(null);
                        return res.status(200).send({success: false, error: err});
                    }
                    willFulfillDeferred.resolve(foundDoc);
                    res.status(200).send({success: true, result: candidate});
                });

            }
        });
    });



    willFulfill.then(function(result){
        console.log("Saved jobseeker");
        db.close();
    });
});



/*
 * Method for Syncing all candidates from mysql to mongo
 * @url http://test.njs.remotestaff.com.au/jobseeker/sync-all/
 *
 */
router.get("/sync-all", function (req, res, next) {
    function delay() {
        return Q.delay(500);
    }
    function syncCandidate(userid){
        //deferred promise will be resolved when part_time_price is fetched
        var sync_candidate_deffered = Q.defer();
        var sync_candidate_promise = sync_candidate_deffered.promise;


        var options = {
            host: njsUrl,
            path: '/jobseeker/sync/?userid=' + userid
        };

        var callback = function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                console.log(str);
                sync_candidate_deffered.resolve({success:true});
            });
        };


        http.get(njsUrl + '/jobseeker/sync/?userid=' + userid, callback);

        return sync_candidate_promise;
    }

    function syncNext(offset){

        if(offset == null){
            return true;
        }

        var syncPromises = [];
        personalInfoSchema.getAll(30, offset, "userid DESC").then(function (candidates) {
            if(candidates){
                for (var i = 0;i < candidates.length;i++){
                    if(typeof candidates[i] != "undefined"){
                        syncPromises.push(syncCandidate(candidates[i]["dataValues"]["userid"]));
                        syncPromises.push(delay);
                    }
                }
            }
            var allSyncPromises = Q.allSettled(syncPromises);
            allSyncPromises.then(function (results) {
                console.log("Sent Sync request from mysql to mongo Done! page " + offset);
                syncNext(null);
            });
        });
    }

    syncNext(0);






    res.status(200).send({success: true});


});


/**
 * Removes the candidate in sync_candidates to resync later
 * @param userid
 */
router.get("/ready-for-sync", function (req, res, next) {
    if (!req.query.userid) {
        var result = {success: false};
        return res.status(200).send(result);
    }


    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");


    var SyncedCandidate = db.model("SyncedCandidate", syncedCandidateSchema);

    db.once('open', function () {


        SyncedCandidate.findOne({candidate_id: parseInt(req.query.userid)}).remove().exec(function(err, result){
            db.close();
            console.log(req.query);
            return res.status(200).send({success:true});
        });


    });

});

/*
 * Method for fetching candidates interview feedback history
 * @url http://test.njs.remotestaff.com.au/jobseeker/get-interview-history/
 * @param int id
 *
 */
router.get("/get-interview-history", function (req, res, next) {


    var interviewFetchDefer = Q.defer();
    var appAppointmentFetchDefer = Q.defer();
    var interviewFetchPromise = interviewFetchDefer.promise;
    var appAppoitmentFetchPromise = appAppointmentFetchDefer.promise;
    var interviewRecord = null;
    var appAppointmentFacilitator = null;
    var fascilitator = [];
    var search_key = {};
    var output = [];
    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key._id = id;
    } else {
        var result = {success: false};
        return res.status(200).send(result);
    }

    tbRequestForInterviewSchema.getInterviewHistory(search_key._id).then(function(result){


        if(result){
            if(result.length > 0){
                interviewRecord = result;
            }
        }
        interviewFetchDefer.resolve(true);
    });

    interviewFetchPromise.then(function () {

        var result = {};

        if(interviewRecord){

            // interviewRecord.forEach(function (data, key) {
            //     if(data){
            //
            //         if(data.dataValues.id && typeof data.dataValues.id !== undefined){
            //
            //             appAppointmentSchema.getAppAppointmentData(data.dataValues.id).then(function(result){
            //
            //                 if(result)
            //                 {
            //
            //                     var admin = result[0]['dataValues'].admin;
            //                     data.dataValues.fac_fname = admin["dataValues"].admin_fname;
            //                     data.dataValues.fac_lname = admin["dataValues"].admin_lname;
            //
            //                     console.log("After insert..");
            //                     console.log(data.dataValues.fac_fname);
            //                     console.log(data.dataValues.fac_lname);
            //
            //
            //
            //                 } else {
            //
            //                 }
            //
            //
            //
            //             });
            //         } else {
            //             data.dataValues.fac_fname = null;
            //             data.dataValues.fac_lname = null;
            //
            //         }
            //     }
            //
            // });


            result = {
                success: true,
                data: interviewRecord
            }
        }
        else
        {
            result = {
                success: false,
                data: null
            }
        }

        return res.status(200).send(result);

    });

});


/*
 * Method for fetching candidates shortlisted history
 * @url http://test.njs.remotestaff.com.au/jobseeker/get-shorlisted-history/
 * @param int id
 *
 */
router.get("/get-shorlisted-history", function (req, res, next) {

    console.log("Getting shortlisted history..");

    var shortlistFetchDefer = Q.defer();
    var shorlistFetchPromise = shortlistFetchDefer.promise;
    var shortlistRecord = null;

    var search_key = {};

    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key._id = id;
    } else {
        var result = {success: false};
        return res.status(200).send(result);
    }

    tbShortlistHistorySchema.getShortlistHistory(search_key._id).then(function(result){
        if(result){
            if(result.length > 0){
                shortlistRecord = result;
            }
        }
        console.log("shortlist fetch done!");
        shortlistFetchDefer.resolve(true);
    });

    Q.allSettled(shorlistFetchPromise).then(function () {
        console.log("Shorlist promise done..");
        return res.status(200).send({success: true, data: shortlistRecord});
    });
});


/*
 * Method for fetching candidates endorsement history
 * @url http://test.njs.remotestaff.com.au/jobseeker/get-endorsement-history/
 * @param int id
 *
 */
router.get("/get-endorsement-history", function (req, res, next) {

    console.log("Getting endorsement history..");

    var endorsementFetchDefer = Q.defer();
    var endorsementFetchPromise = endorsementFetchDefer.promise;
    var endorsementRecord = null;

    var search_key = {};

    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key._id = id;
    } else {
        var result = {success: false};
        return res.status(200).send(result);
    }

    tbEndrosementHistorySchema.getEndrosementHistory(search_key._id).then(function(result){
        if(result){
            if(result.length > 0){
                endorsementRecord = result;
            }
        }
        console.log("endrosement fetch done!");
        endorsementFetchDefer.resolve(true);
    });

    Q.allSettled(endorsementFetchPromise).then(function () {
        console.log("Endrosement promise done..");
        return res.status(200).send({success: true, data: endorsementRecord});
    });


});

/*
 * Method for fetching candidates profile from mongo first
 * @url http://test.njs.remotestaff.com.au/jobseeker/user-info/
 * @param int id
 *
 */
router.get("/user-info", function (req, res, next) {


    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

    var Candidate = db.model("Candidate_Asl", jobseekerSchema);
    var SyncedCandidate = db.model("SyncedCandidate", syncedCandidateSchema);

    var search_key = {};

    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key._id = id;
    } else {
        var result = {success: false};
        return res.status(200).send(result);
    }

    function syncCandidate(userid){
        //deferred promise will be resolved when part_time_price is fetched
        var sync_candidate_deffered = Q.defer();
        var sync_candidate_promise = sync_candidate_deffered.promise;


        var callback = function(response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                sync_candidate_deffered.resolve({success:true});
            });
        };




        console.log("calling http");
        console.log(njsUrl + '/jobseeker/sync/?userid=' + userid);

        http.get(njsUrl + '/jobseeker/sync/?userid=' + userid, callback);

        return sync_candidate_promise;
    }

    var search_sync_candidate_deffered = Q.defer();
    var search_sync_candidate_promise = search_sync_candidate_deffered.promise;

    db.once('open', function () {
        SyncedCandidate.findOne({candidate_id: search_key._id}).exec(function (err, synced_candidate) {

            if(err){
                console.log(error);
            }
            if(synced_candidate){
                search_sync_candidate_deffered.resolve({success:true});
            } else{
                //sync
                syncCandidate(search_key._id).then(function(sync_result){
                    search_sync_candidate_deffered.resolve({success:true});
                });
            }

            search_sync_candidate_promise.then(function(sync_result){
                //check recruitment->candidates first
                Candidate.findOne(search_key).exec(function (err, candidate) {
                    if (candidate) {

                        //if already exist return data
                        db.close();

                        // Compute age

                        candidate.age = moment().diff(candidate.birth_date, 'years');


                        return res.status(200).send({success: true, result: candidate});

                    } else {

                        //sync tests taken
                        db.close();
                        return res.status(200).send({success: false, error: "Candidate not found!"});
                    }
                });
            });


        });

    });

});


/*
 * Method for fetching candidates profile from mongo first
 * @url http://test.njs.remotestaff.com.au/jobseeker/sync/
 * @param int id
 */
router.get("/sync", function (req, res, next) {
    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    //var prod_db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

    var SyncedCandidate = db.model("SyncedCandidate", syncedCandidateSchema);
    var Candidate = db.model("Candidate", jobseekerSchema);
    var PriceFullTime = db.model("PriceFullTime", priceFullTimeSchema);
    var PricePartTime = db.model("PricePartTime", pricePartTimeSchema);
    var candidatesFileUploadsSchema = require("../models/CandidatesFileUploads");
    var CandidatesFileUploads = db.model("CandidatesFileUploads", candidatesFileUploadsSchema);
    var AslCategorizationEntry = db.model("AslCategorizationEntry", aslCategorizationEntry);


    var search_key = {};
    var id = null;

    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key.candidate_id = id;
    } else {
        var result = {success: false, error: "id is required!"};
        return res.status(200).send(result);
    }


    function delay() {
        return Q.delay(100);
    }

    function getFullTimeHourlyRate(rate){
        var yearly_rate = rate * 12;
        var weekly_rate = yearly_rate / 52;
        var daily_rate = weekly_rate / 5;
        var hourly_rate = daily_rate / 8;
        return hourly_rate;
    }

    function getPartTimeHourlyRate(rate){
        var yearly_rate = rate * 12;
        var weekly_rate = yearly_rate / 52;
        var daily_rate = weekly_rate / 5;
        var hourly_rate = daily_rate / 4;

        return hourly_rate;
    }

    db.once('open', function () {
        //prod_db.once('open', function () {
            //check recruitment->candidates first
            SyncedCandidate.findOne(search_key).exec(function (err, candidate) {
                console.log(candidate);
                if (candidate !== null) {

                    //if already exist return data
                    db.close();
                    return res.status(200).send({success: true, result: "Candidate already synced from mysql!"});

                } else {
                    //if not exist fetch data from mysql
                    personalInfoSchema.getPersonalInfo(search_key.candidate_id, true).then(function (personal_mysql_details) {

                        if (personal_mysql_details) {
                            var candidate_details_promises = [];


                            var syncCandidateToInsertdeffered = Q.defer();
                            var syncCandidateToInsertpromise = syncCandidateToInsertdeffered.promise;
                            candidate_details_promises.push(syncCandidateToInsertpromise);
                            candidate_details_promises.push(delay);



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

                            var characterReferencedeffered = Q.defer();
                            var characterReferencepromise = characterReferencedeffered.promise;
                            candidate_details_promises.push(characterReferencepromise);
                            candidate_details_promises.push(delay);



                            //insert
                            syncCandidateToInsert = new SyncedCandidate();
                            syncCandidateToInsert.candidate_id = parseInt(req.query.userid);

                            syncCandidateToInsert.save(function(err){
                                syncCandidateToInsertdeffered.resolve({success:true});
                                if (err){
                                    console.log("Error saving to synced_candidates");
                                    console.log(err);
                                }
                            });


                            try{
                                var fileSyncCallback = function(response) {
                                    var str = '';

                                    //another chunk of data has been recieved, so append it to `str`
                                    response.on('data', function (chunk) {
                                        str += chunk;
                                    });

                                    //the whole response has been recieved, so we just print it out here
                                    response.on('end', function () {

                                        syncImagedeffered.resolve(str);

                                        syncVoicedeffered.resolve(str);

                                        syncApplicantFilesdeffered.resolve(str);

                                    });
                                };


                                var njsUrl = "http://127.0.0.1:3000";
                                var url_str = njsUrl + '/asl/sync-all-candidate-files?userid=' + id;
                                console.log(url_str);

                                http.get(url_str, fileSyncCallback);



                            } catch(error){
                                console.log("Error trying to sync files");

                                syncImagedeffered.resolve(error);

                                syncVoicedeffered.resolve(error);

                                syncApplicantFilesdeffered.resolve(error);
                            }

                            //sync to recruitment->candidates
                            //var birthday = new Date(Date.parse(personal_mysql_details.byear + "-" + personal_mysql_details.bmonth + "-" + personal_mysql_details.bday));
                            var birthday = null;
                            try{
                                if(personal_mysql_details.byear && personal_mysql_details.bmonth && personal_mysql_details.bday){
                                    function pad(num, size) {
                                        var s = num+"";
                                        while (s.length < size) s = "0" + s;
                                        return s;
                                    }
                                    var birthDayStr = personal_mysql_details.byear + "-" + pad(personal_mysql_details.bmonth, 2) + "-" + pad(personal_mysql_details.bday, 2) + "T00:00:00Z";
                                    console.log("bdayStr:");
                                    console.log(birthDayStr);
                                    birthday = moment(birthDayStr).toDate();
                                    console.log(birthday);
                                    if(moment(birthDayStr).format("YYYY-MM-DD").toLowerCase() == "invalid date"){
                                        birthday = null;
                                    }
                                }
                            } catch(major_error){
                                console.log("Error fetching birthday");
                            }



                            var data = {
                                _id: parseInt(id),
                                userid: parseInt(id),
                                first_name: personal_mysql_details.fname,
                                last_name: personal_mysql_details.lname,
                                email: personal_mysql_details.email,
                                // password: personal_mysql_details.pass,
                                gender: personal_mysql_details.gender,
                                mobile: personal_mysql_details.handphone_no,
                                phone: personal_mysql_details.tel_no,
                                skype_id: personal_mysql_details.skype_id,
                                address: personal_mysql_details.address1,
                                dateCreated: personal_mysql_details.datecreated,
                                dateUpdated: personal_mysql_details.dateupdated,
                                birth_date: birthday,
                                computer_hardware: personal_mysql_details.computer_hardware,
                                nationality: personal_mysql_details.nationality,
                                permanent_residence: personal_mysql_details.permanent_residence,
                                headset_quality: personal_mysql_details.headset_quality,
                                home_working_environment: personal_mysql_details.home_working_environment,
                                internet_connection: personal_mysql_details.internet_connection,
                                speed_test: personal_mysql_details.speed_test,
                                image: personal_mysql_details.image,
                                voice: personal_mysql_details.voice_path,
                                alt_email: personal_mysql_details.alt_email,
                                postcode : personal_mysql_details.postcode,
                                state : personal_mysql_details.state,
                                city : personal_mysql_details.city,
                                pregnant : personal_mysql_details.pregnant,
                                pending_visa_application : personal_mysql_details.pending_visa_application,
                                active_visa : personal_mysql_details.active_visa,
                                linked_in : personal_mysql_details.linked_in,
                                facebook_id : personal_mysql_details.facebook_id,
                                icq_id : personal_mysql_details.icq_id,
                                handphone_no : personal_mysql_details.handphone_no,
                                tel_no: personal_mysql_details.tel_no,
                                marital_status: personal_mysql_details.marital_status,
                                handphone_country_code : personal_mysql_details.handphone_country_code,
                                tel_area_code : personal_mysql_details.tel_area_code,
                                auth_no_type_id : personal_mysql_details.auth_no_type_id,
                                msia_new_ic_no : personal_mysql_details.msia_new_ic_no,
                                isShowGender: true,
                                isShowBirthDate: true,
                                isShowNationality: true,
                                isShowWorkingEnvironment: true,
                                isShowInternetConnectionSpeed: true,
                                isShowComputerHardwares: true,
                                isShowheadsetQuality: true,
                                isShowpermanentResidenceObj: true,
                                isShowImage: true,
                                isShowVoice: true,
                                isShowEducationLevel: true,
                                isShowEducationMajor: true,
                                isShowEducationFieldOfStudy: true,
                                isShowEducationUniInstu: true,
                                isShowEducationGradDate: true,
                                isShowEducationLocatedIn: true,
                                isShowEducationTrainingSeminar: true,
                                isShowEducationLicenseCert: true,
                            };


                            var eval_comments_arr = [];
                            var employment_history_arr = [];
                            var latest_job_title_value = "";
                            var availability_value = "";
                            var working_model_value = "";
                            var languages_arr = [];
                            var skills_arr = [];
                            var available_full_time_value = false;
                            var available_part_time_value = false;
                            var full_time_availability_timezone_value = [];
                            var part_time_availability_timezone_value = [];
                            var full_time_rates_value = [];
                            var part_time_rates_value = [];
                            var full_time_rates_id_value = null;
                            var part_time_rates_id_value = null;
                            var full_time_negotiable = null;
                            var part_time_negotiable = null;
                            var tests_taken_value = [];
                            var applicant_files_value = [];
                            var education_value = {};
                            var availability_status_value = {};
                            var recruiter_value = {};
                            var categorization_entries_value = [];
                            var positions_desired_value = [];
                            var character_references_value = [];
                            var preferred_interview_schedule_value = null;
                            var preferred_interview_schedule_arr_value = [];



                            characterReferencesSchema.getCharacterReferences(req.query.userid).then(function(references){
                                try{

                                    for(var i = 0;i < references.length;i++){
                                        if(references[i]["dataValues"]){
                                            var reference = references[i]["dataValues"];
                                            if(reference["contact_details"]){
                                                reference["company"] = reference["contact_details"];
                                            }
                                            character_references_value.push(reference);

                                        }
                                    }
                                } catch(major_error){
                                    console.log("Error fetching character references");
                                    console.log(major_error);
                                }
                                characterReferencedeffered.resolve(true);
                            });


                            var preferredInterviewScheduledeffered = Q.defer();
                            var preferredInterviewSchedulespromise = preferredInterviewScheduledeffered.promise;
                            candidate_details_promises.push(preferredInterviewSchedulespromise);
                            candidate_details_promises.push(delay);


                            var syncRecruiterdeffered = Q.defer();
                            var syncRecruiterpromise = syncRecruiterdeffered.promise;
                            candidate_details_promises.push(syncRecruiterpromise);
                            candidate_details_promises.push(delay);


                            var syncCategoriesdeffered = Q.defer();
                            var syncCategoriespromise = syncCategoriesdeffered.promise;
                            candidate_details_promises.push(syncCategoriespromise);
                            candidate_details_promises.push(delay);


                            //deferred promise will be resolved after updating employment_history
                            var previous_job_industry_deffered = Q.defer();
                            var previous_job_industry_promise = previous_job_industry_deffered.promise;
                            candidate_details_promises.push(previous_job_industry_promise);
                            candidate_details_promises.push(delay);


                            //deferred promise will be resolved when previous salary is fetched
                            var fetch_previous_job_industry_deffered = Q.defer();
                            var fetch_previous_job_industry_promise = fetch_previous_job_industry_deffered.promise;
                            candidate_details_promises.push(fetch_previous_job_industry_promise);
                            candidate_details_promises.push(delay);


                            //deferred promise will be resolved when previous job history is fetched
                            var fetch_previous_job_salary_deffered = Q.defer();
                            var fetch_previous_job_salary_promise = fetch_previous_job_salary_deffered.promise;
                            candidate_details_promises.push(fetch_previous_job_salary_promise);
                            candidate_details_promises.push(delay);



                            //deferred promise will be resolved when staff_rate is fetched
                            var fetch_staff_rate_deffered = Q.defer();
                            var fetch_staff_rate_promise = fetch_staff_rate_deffered.promise;
                            candidate_details_promises.push(fetch_staff_rate_promise);
                            candidate_details_promises.push(delay);


                            //deferred promise will be resolved when fetch_position_desired_deffered is fetched
                            var fetch_position_desired_deffered = Q.defer();
                            var fetch_position_desired_promise = fetch_position_desired_deffered.promise;
                            candidate_details_promises.push(fetch_position_desired_promise);
                            candidate_details_promises.push(delay); 


                            Q.delay(100).then(function(){
                                jobseekerPreferredInterviewScheduleSchema.getInterviewSchedulesToString(search_key.candidate_id).then(function(result){
                                    if(result){
                                        try{
                                            preferred_interview_schedule_value = result.str;
                                            for(var i = 0;i < result.result.length;i++){
                                                if(result.result[i]["dataValues"]){
                                                    preferred_interview_schedule_arr_value.push(result.result[i]["dataValues"]);
                                                }
                                            }
                                        } catch(major_error){
                                            console.log("Error fetching preferred interview schedule");
                                            console.log(major_error);
                                        }

                                        preferredInterviewScheduledeffered.resolve(true);

                                    }
                                });
                            });



                            Q.delay(100).then(function(){
                                var fetch_position_desired = currentjobSchema.fetchPositionDesired(search_key.candidate_id);
                                fetch_position_desired.then(function(position_desired_fetched){
                                    positions_desired_value = position_desired_fetched;
                                    fetch_position_desired_deffered.resolve(true);
                                });
                            });




                            recruiterStaffSchema.getRecruiter(parseInt(req.query.userid)).then(function(result){
                                if(result){
                                    try{

                                        recruiter_value = {
                                            first_name:result.admin_fname,
                                            id:result.admin_id,
                                            last_name:result.admin_lname,
                                            email:result.admin_email,
                                            contact_nos:result.signature_contact_nos,
                                            company:result.signature_company
                                        };
                                    } catch(major_error){
                                        console.log("Error fetching recruiter staff");
                                        console.log(major_error);
                                    }
                                }
                                console.log("recruiter_staff fetched!");
                                syncRecruiterdeffered.resolve(true);
                            });

                            Q.delay(100).then(function(){
                                jobSubCategoryApplicantsSchema.getCatgoriesData(data._id, true).then(function(result){

                                    function saveAslEntry(i){
                                        var saveEntryDefer = Q.defer();
                                        var saveEntryPromise = saveEntryDefer.promise;

                                        var current_item = result[i]["dataValues"];

                                        Q.delay(100).then(function(){
                                            var asl_entry = new AslCategorizationEntry();
                                            asl_entry.saveFromMysql(current_item).then(function(saveResult){
                                                saveEntryDefer.resolve(true);
                                            });
                                        });


                                        return saveEntryPromise;
                                    }



                                    var all_save_entries_promises = [];

                                    if(result){
                                        if(result.length > 0){

                                            try{

                                                for(var i = 0;i < result.length;i++){
                                                    if(result[i]["dataValues"]){
                                                        var current_item = result[i]["dataValues"];

                                                        var current_category_data = {
                                                            shownOnASL: true,
                                                            subCategory: {

                                                            },
                                                            category: {

                                                            },
                                                            dateCreated: current_item.sub_category_applicants_date_created,
                                                            id: current_item.id
                                                        };
                                                        if(current_item["category_info"]){
                                                            current_category_data["category"]["id"] = current_item["category_info"]["category_id"];
                                                            current_category_data["category"]["name"] = current_item["category_info"]["category_name"];
                                                        }

                                                        if(current_item["sub_category_info"]){
                                                            current_category_data["subCategory"]["id"] = current_item["sub_category_info"]["sub_category_id"];
                                                            current_category_data["subCategory"]["name"] = current_item["sub_category_info"]["sub_category_name"];
                                                        }

                                                        all_save_entries_promises.push(saveAslEntry(i));

                                                        categorization_entries_value.push(current_category_data);
                                                    }
                                                }
                                            } catch(major_error){
                                                console.log("Error fetching categories");
                                                console.log(major_error);
                                                syncCategoriesdeffered.resolve(true);
                                            }

                                        }
                                    }
                                    Q.allSettled(all_save_entries_promises).then(function(results){
                                        // console.log("categories fetch done!");
                                        syncCategoriesdeffered.resolve(true);
                                    });

                                });

                            });





                            //staff rate
                            var staff_rate_start_fetching_promise = staffRateSchema.getStaffRateModel(search_key.candidate_id);
                            staff_rate_start_fetching_promise.then(function(fetched_staff_rate){
                                if(fetched_staff_rate){
                                    var product_price_promises = [];

                                     full_time_negotiable = fetched_staff_rate.full_time_negotiable;
                                     part_time_negotiable = fetched_staff_rate.part_time_negotiable;

                                    //deferred promise will be resolved when full_time_price is fetched
                                    // var fetch_full_time_price_mongo_deffered = Q.defer();
                                    // var fetch_full_time_price_mongo_promise = fetch_full_time_price_mongo_deffered.promise;
                                    var newPriceFullTime = new PriceFullTime();
                                    var fetch_full_time_price_mongo_promise = newPriceFullTime.fetchById(fetched_staff_rate.product_id);
                                    product_price_promises.push(fetch_full_time_price_mongo_promise);
                                    product_price_promises.push(delay);

                                    //deferred promise will be resolved when part_time_price is fetched
                                    // var fetch_part_time_price_mongo_deffered = Q.defer();
                                    // var fetch_part_time_price_mongo_promise = fetch_part_time_price_mongo_deffered.promise;
                                    var newPricePartTime = new PricePartTime();
                                    var fetch_part_time_price_mongo_promise = newPricePartTime.fetchById(fetched_staff_rate.part_time_product_id);
                                    product_price_promises.push(fetch_part_time_price_mongo_promise);
                                    product_price_promises.push(delay);

                                    fetch_full_time_price_mongo_promise.then(function(fetched_full_time_price){
                                        if(fetched_full_time_price){

                                            try{

                                                full_time_rates_id_value = fetched_staff_rate.product_id;

                                                var str_php_rate = fetched_full_time_price.code.replace("PHP-FT-", "");
                                                str_php_rate = str_php_rate.replace(",", "");
                                                var float_php_rate = getFullTimeHourlyRate(parseFloat(str_php_rate)).toFixed(2);
                                                var php_monthly_rate = {
                                                    currency: "PHP",
                                                    value: parseFloat(str_php_rate),
                                                    billingType: "monthly"
                                                };
                                                full_time_rates_value.push(php_monthly_rate);

                                                var php_hourly_rate = {
                                                    currency: "PHP",
                                                    value: parseFloat(float_php_rate),
                                                    billingType: "hourly"
                                                };
                                                full_time_rates_value.push(php_hourly_rate);

                                                fetched_full_time_price.details.forEach(function(value){
                                                    var float_rate = getFullTimeHourlyRate(parseFloat(value.amount)).toFixed(2);
                                                    var current_monthly_rate = {
                                                        currency: value.currency,
                                                        value: parseFloat(value.amount),
                                                        billingType: "monthly"
                                                    };
                                                    full_time_rates_value.push(current_monthly_rate);

                                                    var current_hourly_rate = {
                                                        currency: value.currency,
                                                        value: parseFloat(float_rate),
                                                        billingType: "hourly"
                                                    };
                                                    full_time_rates_value.push(current_hourly_rate);

                                                });
                                            } catch(major_error){
                                                console.log("Error fetching full time rate");
                                                console.log(major_error);
                                            }
                                        }
                                    });


                                    fetch_part_time_price_mongo_promise.then(function(fetched_part_time_price){
                                        if(fetched_part_time_price){
                                            try{


                                                part_time_rates_id_value = fetched_staff_rate.part_time_product_id;

                                                var php_monthly_rate = fetched_part_time_price.code.replace("PHP-PT-", "");
                                                php_monthly_rate = php_monthly_rate.replace(",", "");
                                                var float_rate = getPartTimeHourlyRate(parseFloat(php_monthly_rate)).toFixed(2);

                                                var current_monthly_rate = {
                                                    currency: "PHP",
                                                    value: parseFloat(php_monthly_rate),
                                                    billingType: "monthly"
                                                };
                                                part_time_rates_value.push(current_monthly_rate);


                                                var current_hourly_rate = {
                                                    currency: "PHP",
                                                    value: parseFloat(float_rate),
                                                    billingType: "hourly"
                                                };
                                                part_time_rates_value.push(current_hourly_rate);


                                                fetched_part_time_price.details.forEach(function(value){
                                                    var current_monthly_rate = {
                                                        currency: value.currency,
                                                        value: parseFloat(value.amount),
                                                        billingType: "monthly"
                                                    };
                                                    part_time_rates_value.push(current_monthly_rate);

                                                    var current_hourly_rate = {
                                                        currency: value.currency,
                                                        value: parseFloat(getPartTimeHourlyRate(parseFloat(value.amount)).toFixed(2)),
                                                        billingType: "hourly"
                                                    };
                                                    part_time_rates_value.push(current_hourly_rate);

                                                });
                                            } catch(major_error){
                                                console.log("Error fetching part time rate");
                                                console.log(major_error);
                                            }
                                        }
                                    });


                                    var allPricePromises = Q.allSettled(product_price_promises);
                                    allPricePromises.then(function (results) {
                                        fetch_staff_rate_deffered.resolve({success:true});
                                    });
                                } else{
                                    fetch_staff_rate_deffered.resolve({success:true});
                                }
                            });


                            //Evaluation comments
                            var eval_comments_fetch_promise = evaluationCommentsSchema.getEvaluationComments(search_key.candidate_id);
                            eval_comments_fetch_promise.then(function (fetched_eval_comments) {

                                if (fetched_eval_comments) {
                                    try{
                                        for (var i = 0; i < fetched_eval_comments.length; i++) {
                                            var current_eval_comment = fetched_eval_comments[i]["dataValues"];
                                            var data_eval_comment = {
                                                id: current_eval_comment.id,
                                                comments: null,// JSON.parse(JSON.stringify(current_eval_comment.comments.trim())),
                                                comment_date: current_eval_comment.comment_date,
                                                // commentBy:{
                                                //     id: current_eval_comment.comment_by
                                                // }
                                                comment_by: current_eval_comment.comment_by,
                                                is_show_resume: true

                                            };

                                            if(current_eval_comment.comments){
                                                data_eval_comment.comments = JSON.parse(JSON.stringify(current_eval_comment.comments.trim()));
                                            }

                                            if (current_eval_comment["comment_by"]) {
                                                data_eval_comment["comment_by_name"] = current_eval_comment["admin"]["dataValues"]["admin_fname"] + " " + current_eval_comment["admin"]["dataValues"]["admin_lname"];
                                                data_eval_comment["comment_by_first_name"] = current_eval_comment["admin"]["dataValues"]["admin_fname"];
                                                data_eval_comment["comment_by_last_name"] = current_eval_comment["admin"]["dataValues"]["admin_lname"];

                                            }
                                            eval_comments_arr.push(data_eval_comment);
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching evaluation comments");
                                        console.log(major_error);
                                    }

                                }
                            });

                            candidate_details_promises.push(eval_comments_fetch_promise);
                            candidate_details_promises.push(delay);


                            //Personal Working Model
                            var working_model_promise = personalWorkingModelSchema.getPersonalWorkingModel(search_key.candidate_id);
                            working_model_promise.then(function(foundWorkingModel){
                                if(foundWorkingModel){
                                    try{
                                        if(foundWorkingModel.working_model == "home_based"){
                                            working_model_value = "Home Based";
                                        } else if(foundWorkingModel.working_model == "office_based"){
                                            working_model_value = "Office Based";
                                        } else{
                                            working_model_value = "Home Based and Office Based";
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching working model");
                                        console.log(major_error);
                                    }

                                }
                            });
                            candidate_details_promises.push(working_model_promise);
                            candidate_details_promises.push(delay);


                            //Languages
                            var languages_promise = languagesSchema.getLanguages(search_key.candidate_id);
                            languages_promise.then(function(foundLanguages){
                                if(foundLanguages){
                                    try{

                                        for(var i = 0;i < foundLanguages.length;i++){
                                            var current_language = foundLanguages[i]["dataValues"];
                                            var data_language = {
                                                id: current_language.id,
                                                language: current_language.language,
                                                spoken: current_language.spoken,
                                                written: current_language.written,
                                                spoken_assessment: current_language.spoken_assessment,
                                                written_assessment: current_language.written_assessment,
                                                is_show_resume: true
                                            };

                                            languages_arr.push(data_language);
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching languages");
                                        console.log(major_error);
                                    }
                                }
                            });
                            candidate_details_promises.push(languages_promise);
                            candidate_details_promises.push(delay);


                            //Skills
                            var skills_promise = skillsSchema.getSkills(search_key.candidate_id);
                            skills_promise.then(function(foundSkills){
                                if(foundSkills){
                                    try{

                                        for(var i = 0;i < foundSkills.length;i++){
                                            var current_skill = foundSkills[i]["dataValues"];
                                            var data_skill = {
                                                id: current_skill.id,
                                                skill: current_skill.skill,
                                                experience: current_skill.experience,
                                                proficiency: current_skill.proficiency
                                            };

                                            var yearsExp = "";
                                            var proficiency = "";

                                            if (current_skill.experience == 0.5) {
                                                yearsExp = "Less than 6 months";
                                            } else if (current_skill.experience == 0.75) {
                                                yearsExp = "Over 6 months";
                                            } else if (current_skill.experience == 1) {
                                                yearsExp = "1 year";
                                            } else if (current_skill.experience == 2) {
                                                yearsExp = "2 years";
                                            } else if (current_skill.experience == 3) {
                                                yearsExp = "3 years";
                                            } else if (current_skill.experience == 4) {
                                                yearsExp = "4 years";
                                            } else if (current_skill.experience == 5) {
                                                yearsExp = "5 years";
                                            } else if (current_skill.experience == 6) {
                                                yearsExp = "6 years";
                                            } else if (current_skill.experience == 7) {
                                                yearsExp = "7 years";
                                            } else if (current_skill.experience == 8) {
                                                yearsExp = "8 years";
                                            } else if (current_skill.experience == 9) {
                                                yearsExp = "9 years";
                                            } else if (current_skill.experience == 10) {
                                                yearsExp = "10 years";
                                            } else {
                                                yearsExp = "More than 10 years";
                                            }

                                            if (current_skill.proficiency == 1) {
                                                proficiency = "Beginner";
                                            } else if (current_skill.proficiency == 2) {
                                                proficiency = "Intermediate";
                                            } else if (current_skill.proficiency == 3) {
                                                proficiency = "Advance";
                                            }

                                            data_skill.experienceStr = yearsExp;
                                            data_skill.proficiencyStr = proficiency;
                                            data_skill.is_show_resume = true;

                                            skills_arr.push(data_skill);
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching skills");
                                        console.log(major_error);
                                    }

                                }
                            });

                            candidate_details_promises.push(skills_promise);
                            candidate_details_promises.push(delay);


                            //timezone availability
                            var fetch_timezone_availability_promise = staffTimezoneSchema.getStaffTimeZoneModel(search_key.candidate_id);
                            fetch_timezone_availability_promise.then(function(foundStaffTimezone){
                                if(foundStaffTimezone){

                                    if(foundStaffTimezone.time_zone != null && foundStaffTimezone.time_zone != ""){
                                        try{
                                            var exploded_full_time_zone = foundStaffTimezone.time_zone.split(",");
                                            var temp_full_time_zone = [];
                                            var any_found = false;
                                            exploded_full_time_zone.forEach(function (current_time_zone) {
                                                if(current_time_zone != "ANY"){
                                                    temp_full_time_zone.push(current_time_zone);
                                                } else if(current_time_zone == "ANY"){
                                                    any_found = true;
                                                    return false;
                                                }
                                            });
                                            //if ANY is found then insert all
                                            if(any_found){
                                                temp_full_time_zone = [];
                                                temp_full_time_zone.push("AU");
                                                temp_full_time_zone.push("UK");
                                                temp_full_time_zone.push("US");
                                            }
                                            full_time_availability_timezone_value = temp_full_time_zone;
                                            available_full_time_value = true;
                                        } catch(major_error){
                                            console.log("Error fetching full time zone");
                                            console.log(major_error);
                                        }

                                    }

                                    if(foundStaffTimezone.p_timezone != null && foundStaffTimezone.p_timezone != ""){
                                        try{
                                            var exploded_part_time_zone = foundStaffTimezone.p_timezone.split(",");
                                            var temp_part_time_zone = [];
                                            var any_found = false;
                                            exploded_part_time_zone.forEach(function (current_time_zone) {
                                                if(current_time_zone != "ANY"){
                                                    temp_part_time_zone.push(current_time_zone);
                                                } else if(current_time_zone == "ANY"){
                                                    any_found = true;
                                                    return false;
                                                }
                                            });
                                            //if ANY is found then insert all
                                            if(any_found){
                                                temp_part_time_zone = [];
                                                temp_part_time_zone.push("AU");
                                                temp_part_time_zone.push("UK");
                                                temp_part_time_zone.push("US");
                                            }
                                            part_time_availability_timezone_value = temp_part_time_zone;
                                            available_part_time_value = true;
                                        } catch(major_error){
                                            console.log("Error fetching part time zone");
                                            console.log(major_error);
                                        }
                                    }
                                }
                            });

                            candidate_details_promises.push(fetch_timezone_availability_promise);
                            candidate_details_promises.push(delay);


                            var employment_history_limit = 10;


                            //before saving gather all info from currentjob
                            var currentJob_promise = currentjobSchema.getCurrentJobInfo(search_key.candidate_id);
                            currentJob_promise.then(function (currentjob_found) {


                                if (currentjob_found) {
                                    try{

                                        availability_status_value = {
                                            aday: currentjob_found.aday,
                                            amonth: currentjob_found.amonth,
                                            available_notice: currentjob_found.available_notice,
                                            available_notice_duration: currentjob_found.available_notice_duration,
                                            available_status: currentjob_found.available_status,
                                            ayear: currentjob_found.ayear,
                                            years_worked: currentjob_found.dataValues.years_worked
                                        };


                                        if(currentjob_found.latest_job_title){
                                            latest_job_title_value = currentjob_found.latest_job_title.trim();
                                        }
                                        //get availability status text
                                        if (currentjob_found.available_status == "a") {
                                            availability_value = "I can start work after " + currentjob_found.available_notice + " "+ currentjob_found.available_notice_duration + " of notice period";
                                        } else if (currentjob_found.available_status == "b") {
                                            availability_value = "I can start work after " + currentjob_found.ayear + "-" + currentjob_found.amonth + "-" + currentjob_found.aday;
                                        } else if (currentjob_found.available_status == 'p') {
                                            availability_value = "I am not actively looking for a job now";
                                        } else {
                                            availability_value = "Work Immediately";
                                        }
                                        //data.employment_history = [];
                                        for (var i = 1; i <= employment_history_limit; i++) {
                                            //loop through employment history
                                            if (i == 1) {
                                                if(currentjob_found["companyname"]){
                                                    var current_entry = {

                                                    };
                                                    if(currentjob_found["companyname"]){
                                                        current_entry["companyname"] = currentjob_found["companyname"].trim();
                                                    }

                                                    if(currentjob_found["position"]){
                                                        current_entry["position"] = currentjob_found["position"].trim();
                                                    }

                                                    if(currentjob_found["monthfrom"]){
                                                        current_entry["monthfrom"] = currentjob_found["monthfrom"].trim();
                                                    }

                                                    if(currentjob_found["yearfrom"]){
                                                        current_entry["yearfrom"] = currentjob_found["yearfrom"].trim();
                                                    }

                                                    if(currentjob_found["monthto"]){
                                                        current_entry["monthto"] = currentjob_found["monthto"].trim();
                                                    }

                                                    if(currentjob_found["yearto"]){
                                                        current_entry["yearto"] = currentjob_found["yearto"].trim();
                                                    }

                                                    if(currentjob_found["duties"]){
                                                        current_entry["duties"] = JSON.parse(JSON.stringify(currentjob_found["duties"].trim()));
                                                    }
                                                    current_entry["is_show_resume"] = true;
                                                    employment_history_arr.push(current_entry);
                                                }


                                            } else {
                                                if(currentjob_found["companyname" + i]){
                                                    var current_entry = {

                                                    };

                                                    if(currentjob_found["companyname" + i]){
                                                        current_entry["companyname"] = currentjob_found["companyname" + i].trim();
                                                    }

                                                    if(currentjob_found["position" + i]){
                                                        current_entry["position"] = currentjob_found["position" + i].trim();
                                                    }

                                                    if(currentjob_found["monthfrom" + i]){
                                                        current_entry["monthfrom"] = currentjob_found["monthfrom" + i].trim();
                                                    }

                                                    if(currentjob_found["yearfrom" + i]){
                                                        current_entry["yearfrom"] = currentjob_found["yearfrom" + i].trim();
                                                    }

                                                    if(currentjob_found["monthto" + i]){
                                                        current_entry["monthto"] = currentjob_found["monthto" + i].trim();
                                                    }

                                                    if(currentjob_found["yearto" + i]){
                                                        current_entry["yearto"] = currentjob_found["yearto" + i].trim();
                                                    }

                                                    if(currentjob_found["duties" + i]){
                                                        current_entry["duties"] = JSON.parse(JSON.stringify(currentjob_found["duties" + i].trim()));
                                                    }
                                                    current_entry["is_show_resume"] = true;
                                                    employment_history_arr.push(current_entry);
                                                }

                                            }
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching currentjob");
                                        console.log(major_error);
                                    }


                                }
                                previous_job_industry_deffered.resolve({success: true});


                            });
                            candidate_details_promises.push(currentJob_promise);
                            candidate_details_promises.push(delay);


                            //fetch previous_job_industries
                            previous_job_industry_promise.then(function (data_from_currentjob) {


                                previousJobIndustriesSchema.getPreviousJobIndustries(search_key.candidate_id).then(function (previous_job_industries_fetched) {

                                    try{
                                        if (previous_job_industries_fetched) {
                                            if(previous_job_industries_fetched.length > 0){
                                                for (var i = 0; i < employment_history_limit; i++) {
                                                    var current_job_industry = previous_job_industries_fetched[i];
                                                    if(current_job_industry){
                                                        if(current_job_industry.industry_name){
                                                            if(employment_history_arr[i]){
                                                                employment_history_arr[i]["industry"] = current_job_industry.industry_name.trim();
                                                                employment_history_arr[i]["industry_id"] = current_job_industry.industry_id;
                                                            }

                                                        }
                                                    }
                                                }
                                            }

                                        }

                                        fetch_previous_job_industry_deffered.resolve(data_from_currentjob);
                                    } catch(error){
                                        console.log("Error fetching previous_job_industry");
                                        console.log(error);
                                        fetch_previous_job_industry_deffered.resolve(data_from_currentjob);
                                    }

                                });

                                previousJobSalaryGradesSchema.getPreviousJobSalaryGrades(search_key.candidate_id).then(function(previous_job_salary){
                                    try{
                                        if (previous_job_salary) {
                                            if(previous_job_salary.length > 0){
                                                for (var i = 0; i < employment_history_limit; i++) {
                                                    var current_job_salary = previous_job_salary[i];
                                                    if(current_job_salary){
                                                        if(current_job_salary.starting_grade){
                                                            if(employment_history_arr[i]){
                                                                employment_history_arr[i]["starting_grade"] = current_job_salary.starting_grade.trim();
                                                            }
                                                        }

                                                        if(current_job_salary.ending_grade){
                                                            if(employment_history_arr[i]){
                                                                employment_history_arr[i]["ending_grade"] = current_job_salary.ending_grade.trim();
                                                            }
                                                        }

                                                        if(current_job_salary.benefits){
                                                            if(employment_history_arr[i]){
                                                                employment_history_arr[i]["benefits"] = current_job_salary.benefits.trim();
                                                            }
                                                        }
                                                    }
                                                }
                                            }

                                        }
                                        fetch_previous_job_salary_deffered.resolve(data_from_currentjob);
                                    } catch(error){
                                        console.log("Error fetching previous_job_salary");
                                        console.log(error);
                                        fetch_previous_job_salary_deffered.resolve(data_from_currentjob);
                                    }
                                });
                            });


                            var applicant_files_fetch_promise = applicantFilesSchema.fetchAll(parseInt(req.query.userid));
                            candidate_details_promises.push(applicant_files_fetch_promise);
                            candidate_details_promises.push(delay);

                            applicant_files_fetch_promise.then(function(foundApplicantFiles){
                                if(foundApplicantFiles){
                                    try{
                                        for(var i = 0;i < foundApplicantFiles.length;i++){
                                            var current_file = foundApplicantFiles[i];
                                            current_file["dataValues"]["is_show_resume"] = true;
                                            applicant_files_value.push(current_file["dataValues"]);
                                        }
                                    } catch(major_error){
                                        console.log("Error fetching applicant files");
                                        console.log(major_error);
                                    }

                                }

                            });

                            var education_fetch_promise = educationSchema.getEducationInfo(parseInt(req.query.userid), true);
                            candidate_details_promises.push(education_fetch_promise);
                            candidate_details_promises.push(delay);

                            education_fetch_promise.then(function(foundEducation){
                                if(foundEducation){
                                    education_value = foundEducation["dataValues"];
                                }
                            });


                            var allPromise = Q.allSettled(candidate_details_promises);
                            allPromise.then(function (results) {
                                console.log("All candidate details promises done!");
                                if(results){
                                    data["working_model"] = working_model_value;
                                    data["availability_str"] = availability_value;
                                    data["availability_status"] = availability_status_value;
                                    data["latest_job_title"] = latest_job_title_value;
                                    data["languages"] = languages_arr;
                                    data["skills"] = skills_arr;
                                    data["evaluation_comments"] = eval_comments_arr;
                                    data["employment_history"] = employment_history_arr;
                                    data["available_full_time"] = available_full_time_value;
                                    data["available_part_time"] = available_part_time_value;
                                    data["full_time_availability_timezone"] = full_time_availability_timezone_value;
                                    data["part_time_availability_timezone"] = part_time_availability_timezone_value;
                                    data["full_time_rates"] = full_time_rates_value;
                                    data["part_time_rates"] = part_time_rates_value;
                                    data["full_time_negotiable"] = full_time_negotiable;
                                    data["part_time_negotiable"] = part_time_negotiable;
                                    data["tests_taken"] = tests_taken_value;
                                    data["applicant_files"] = applicant_files_value;
                                    data["education"] = education_value;
                                    data["full_time_rates_id"] = full_time_rates_id_value;
                                    data["part_time_rates_id"] = part_time_rates_id_value;
                                    data["recruiter"] = recruiter_value;
                                    data["categorization_entries"] = categorization_entries_value;
                                    data["positions_desired"] = positions_desired_value;
                                    data["character_references"] = character_references_value;
                                    data["preferred_interview_schedules_str"] = preferred_interview_schedule_value;
                                    data["preferred_interview_schedules"] = preferred_interview_schedule_arr_value;
                                }

                                var job_seeker_search_key = {_id: parseInt(req.query.userid)};

                                function syncToSolr(data){
                                    try{
                                        var callback = function(response) {
                                            var str = '';

                                            //another chunk of data has been recieved, so append it to `str`
                                            response.on('data', function (chunk) {
                                                str += chunk;
                                            });

                                            //the whole response has been recieved, so we just print it out here
                                            response.on('end', function () {

                                            });
                                        };

                                        var njsUrl = "http://127.0.0.1:3000";
                                        console.log("calling " + njsUrl + '/jobseeker/sync-solr?userid=' + req.query.userid);

                                        http.get(njsUrl + '/jobseeker/sync-solr?userid=' + req.query.userid, callback);

                                    } catch(error){
                                        console.log("Error syncing to solr");
                                        console.log(error);
                                    }
                                }



                                Candidate.findOne(job_seeker_search_key).exec(function(err, foundDoc){


                                    function updateMongoDoc(data, callback){
                                        data.computer_hardwares = foundDoc.extractComputerHardwares(data.computer_hardware);
                                        Candidate.update(job_seeker_search_key, data, {upsert: true}, callback);
                                    }

                                    if (err) {
                                        console.log("Error fetching jobseeker on mongo");
                                        console.log(err);
                                        db.close();
                                        return res.status(200).send({success: false, error: err});
                                    }

                                    if(foundDoc){
                                        console.log("Trying to update to mongo jobseeker");
                                        if(typeof data["_id"] != "undefined"){
                                            delete data["_id"];
                                        }
                                        //evaluate computer
                                        //update
                                        updateMongoDoc(data, function(err){
                                            db.close();
                                            if(err){
                                                console.log("Error saving to mongo jobseeker");
                                                console.log(err);
                                                return res.status(200).send({success: false, error: err});
                                            }
                                            console.log("record updated!");
                                            syncToSolr(data);
                                            res.status(200).send({success: true, result: foundDoc});
                                        });
                                    } else{
                                        console.log("Trying to insert to mongo jobseeker");
                                        //insert
                                        foundDoc = new Candidate(data);
                                        foundDoc.extractComputerHardwares(data.computer_hardware);

                                        console.log("Trying to insert AGAIN to mongo jobseeker");

                                        foundDoc.save(function(err){
                                            db.close();
                                            if (err){
                                                console.log("Error inserting to mongo jobseeker");
                                                console.log(err);
                                                return res.status(200).send({success: false, error: err});
                                            }
                                            console.log("record inserted!");
                                            syncToSolr(data);
                                            res.status(200).send({success: true, result: foundDoc});
                                        });

                                    }
                                });




                            });


                        } else {
                            db.close();
                            //prod_db.close();
                            return res.status(200).send({success: false, mysql_result: personal_mysql_details});
                        }
                    }).catch(function (err) {
                        result = {
                            success: false,
                            msg: err + "getpersonalInfo"
                        };
                        db.close();
                        //prod_db.close();
                        return res.status(200).send({success: false, result: result});
                    });


                }

            });

        // });

    });
});




/*
 * Method to fetch staff history from mongo if not in mongo sync from mysql
 * @url http://test.njs.remotestaff.com.au/jobseeker/get-staff-history/
 *
 */
router.get("/get-staff-history", function (req, res, next) {
    var id;
    if (req.query.userid) {
        var id = parseInt(req.query.userid);
    } else {
        var result = {success: false, error: "userid is required!"};
        return res.status(200).send(result);
    }

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

    var SyncedStaffHIstory = db.model("SyncedStaffHIstory", syncedStaffHistorySchema);
    var StaffHistory = db.model("StaffHistory", staffHistoryMongoSchema);

    db.once('open', function () {
        SyncedStaffHIstory.findOne({candidate_id:id}).exec(function (err, syncedStaffHistory) {
            if(syncedStaffHistory){
                StaffHistory.find({userid:id}).sort({dateChange: -1}).exec(function (err, foundStaffHistories){
                    return res.status(200).send({success:true, result:foundStaffHistories});
                });
            } else{
                //sync first


                var staffHistoryMysqlFetchDeferred = Q.defer();
                var staffHistoryMysqlFetchPromise = staffHistoryMysqlFetchDeferred.promise;

                function getStaffHistory(offset){
                    if(offset == null){
                        staffHistoryMysqlFetchDeferred.resolve({success:true});
                        return true;
                    }
                    staffHistorySchema.getStaffHistory(id, 30, offset, "id DESC").then(function(foundMysqlStaffHistories){
                        if(foundMysqlStaffHistories.length > 0){
                            foundMysqlStaffHistories.forEach(function(current_item){
                                var data = {
                                    userid: parseInt(id)
                                };
                                var current_history = current_item["dataValues"];
                                data.changes = current_history.changes.trim();
                                data.dateChange = current_history.date_change;


                                if(typeof current_history.admin != "undefined"){
                                    if(typeof current_history.admin["dataValues"] != "undefined"){
                                        var admin_details = current_history.admin["dataValues"];
                                        data.changeBy = {
                                            id: admin_details.admin_id,
                                            firstName: admin_details.admin_fname,
                                            lastName: admin_details.admin_lname
                                        };
                                    }
                                }
                                //insert
                                db.collection('staff_history').insert(data, callback);
                                function callback(err, docs) {
                                    if (err) {
                                        console.log(err + "insertErr");
                                    } else {
                                        var result = {success: true, msg: "created", result: docs.ops[0]};
                                        console.log(result);
                                    }
                                };

                            });
                            ++offset;
                            getStaffHistory(offset);
                        } else{
                            getStaffHistory(null);
                        }
                    });
                }

                getStaffHistory(0);


                staffHistoryMysqlFetchPromise.then(function(result){

                    db.collection('synced_staff_history').insert({candidate_id:id}, callback);
                    function callback(err, docs) {
                        if (err) {
                            console.log(err + "insertErr");
                        } else {
                            var result = {success: true, msg: "created", result: docs.ops[0]};
                            console.log(result);
                        }
                    };
                    //return
                    StaffHistory.find({userid:id}).sort({dateChange: -1}).exec(function (err, foundStaffHistories){
                        return res.status(200).send({success:true, msg: "created", result:foundStaffHistories});
                    });

                });

            }
        });
    });
});


//saving personal info updates
router.post("/save-personal-info", function (req, res, next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var SyncedCandidate = db.model("SyncedCandidate", syncedCandidateSchema);

    var result = {};
    var search_key = {};

    if(req.body.candidate)
    {

        userinfo = req.body.candidate;

        search_key.candidate_id = parseInt(userinfo._id);

        db.once('open', function () {
            SyncedCandidate.findOneAndRemove(search_key,function(err,sync){

                if(err)
                {
                    db.close();
                    result = {success: false, msg:"Failed to save. Please check candidate details"};
                    return res.status(200).send(result);
                }
                else {

                    personalInfoSchema.saveInfo(userinfo).then(function(infoResult){
                        db.close();
                        result = {success: true, msg:infoResult};
                        return res.status(200).send(result);
                    }).catch(function(err){

                        result = {success: false, msg:"Failed to save. Please check candidate details"};
                        return res.status(200).send(result);

                    });
                }

            });
        });



    }
    else {
        result = {success: false, msg:"Failed to save. Please check candidate details"};
        return res.status(200).send(result);
    }

});


router.post("/del-sync", function (req, res, next) {


    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var SyncedCandidate = db.model("SyncedCandidate", syncedCandidateSchema);

    var search_key = {};
    search_key.candidate_id = parseInt(req.body.userid);

    SyncedCandidate.findOneAndRemove(search_key,function(err,sync){

        if(err)
        {
            db.close();
            result = {success: false, msg:"Failed to save. Please check candidate details"};
            return res.status(200).send(result);
        }
        else {

            db.close();
            result = {success: true};
            return res.status(200).send(result);
        }

    });

});


/**
 * Sync a single candidate to solr
 * if prod.jobseeker record if found use that
 * fetch from mysql otherwise
 *
 * skip_lookup Will skip looking up candidate on solr_candidates before syncing
 *
 * @param userid The userid of the candidate
 */
router.get("/sync-solr", function (req, res, next) {

    console.log(req.query);
    if(isNaN(req.query.userid) || !req.query.userid || req.query.userid == ""){
        return res.status(200).send({success:false, error: "userid is required!"});
    }



    var candidate = {
        id: parseInt(req.query.userid),
    };


    candidatesQueue.add({processCandidate:candidate, skip_lookup: true});

    res.status(200).send({success:true, result: req.query});
});


/**
 * Sync multiple candidates to solr
 *
 */
router.get("/sync-solr-multiple", function (req, res, next) {

    if(!req.query.sync_all){
        return res.status(200).send({success:false});
    }


    var candidatesQueue = require("../bull/candidates_queue");
    var multipleCandidatesQueue = require("../bull/candidates_cluster");

    var multiProcessQueue = require("../bull/cluster_process");
    var candidatesProcessDef = require("../bull/candidates");


    multipleCandidatesQueue.add({sync_all: true});


    // function addJobSolrSync(candidate){
    //     var willFulfillDeferred = Q.defer();
    //     var willFulfill = willFulfillDeferred.promise;
    //
    //     candidatesQueue.add({processCandidate:candidate});
    //     willFulfillDeferred.resolve(true);
    //
    //     return willFulfill;
    // }
    //
    // function getCandidatesToSync(retries){
    //     if(retries >= 1){
    //         return true;
    //     }
    //     solrCandidatesSchema.getCandidatesToSync(100).then(function(candidates){
    //         if(candidates){
    //             if(candidates.length > 0){
    //
    //                 var all_sync_jobs = [];
    //
    //                 for(var i = 0;i < candidates.length;i++){
    //                     var candidate = {
    //                         id: parseInt(candidates[i].userid),
    //                     };
    //                     all_sync_jobs.push(addJobSolrSync(candidate));
    //                     all_sync_jobs.push(delay);
    //                 }
    //
    //
    //                 var allPromises = Q.allSettled(all_sync_jobs);
    //                 allPromises.then(function (results) {
    //                     console.log("created jobs for at least 100 candidates");
    //                     getCandidatesToSync(++retries);
    //                 });
    //
    //             }
    //         }
    //     });
    // }
    // getCandidatesToSync(0);


    // solrCandidatesSchema.getCandidatesToSync(100).then(function(candidates_to_sync){
    //     if(candidates_to_sync){
    //         if(candidates_to_sync.length > 0){
    //             for(var i = 0;i < candidates_to_sync.length;i++){
    //                 var current_candidate = candidates_to_sync[i];
    //
    //                 var candidate = {
    //                     id: parseInt(current_candidate.userid)
    //                 };
    //
    //                 candidatesQueue.add({processCandidate:candidate});
    //             }
    //             console.log("created for 100 candidates");
    //         } else{
    //             console.log("no more candidates");
    //         }
    //     } else{
    //         console.log("no more candidates");
    //     }
    // });



    res.status(200).send({success:true, result: req.query});

});



/**
 * inactivate candidate
 *
 */
router.post("/move-to-inactive", function (req, res, next) {
    if(!req.body.candidate){
        return res.status(200).send({success:false, error: "candidate is required!"});
    }

    if(!req.body.inactive_entry){
        return res.status(200).send({success:false, error: "inactive_entry is required!"});
    }

    if(!req.body.staff_history){
        return res.status(200).send({success:false, error: "staff history is required!"});
    }

    var inactiveStaffSchema = require("../mysql/InactiveHistory");
    var StaffHistory = require("../mysql/StaffHistory");

    var inactive_entry = req.body.inactive_entry;

    inactive_entry.userid = req.body.candidate.id;

    //remove inactive entry
    inactiveStaffSchema.saveSingle(req.body.inactive_entry).then(function(result){
        // try{
        //     var callback = function(response) {
        //         var str = '';
        //
        //         //another chunk of data has been recieved, so append it to `str`
        //         response.on('data', function (chunk) {
        //             str += chunk;
        //         });
        //
        //         //the whole response has been recieved, so we just print it out here
        //         response.on('end', function () {
        //
        //         });
        //     };
        //
        //     var njsUrl = "http://127.0.0.1:3000";
        //
        //     //http.get(apiUrl + '/solr-index/sync-candidates/?userid=' + candidate._id, callback);
        //     http.get(njsUrl + '/jobseeker/sync-solr?userid=' + data.candidate_id, callback);
        //
        //     console.log(njsUrl + '/jobseeker/sync-solr?userid=' + data.candidate_id);
        // } catch(error){
        //     console.log(error);
        // }
        

        res.status(200).send({success:true, result: "Candidate Reactivated!"});
    });


    StaffHistory.batchSave(req.body.staff_history);

});


/**
 * reactivate candidate
 *
 */
router.post("/reactivate", function (req, res, next) {
    if(!req.body.candidate){
        return res.status(200).send({success:false, error: "candidate is required!"});
    }

    if(!req.body.note){
        return res.status(200).send({success:false, error: "note is required!"});
    }

    if(!req.body.staff_history){
        return res.status(200).send({success:false, error: "staff history is required!"});
    }

    var inactiveStaffSchema = require("../mysql/InactiveHistory");
    var activateEntrySchema = require("../mysql/ActivateEntry");
    var StaffHistory = require("../mysql/StaffHistory");

    var data = {
        candidate_id: req.body.candidate.id,
        is_processed: false,
        note: req.body.note
    };


    //remove inactive entry
    inactiveStaffSchema.removeData(data.candidate_id).then(function(result){
        // try{
        //     var callback = function(response) {
        //         var str = '';
        //
        //         //another chunk of data has been recieved, so append it to `str`
        //         response.on('data', function (chunk) {
        //             str += chunk;
        //         });
        //
        //         //the whole response has been recieved, so we just print it out here
        //         response.on('end', function () {
        //
        //         });
        //     };
        //
        //     var njsUrl = "http://127.0.0.1:3000";
        //
        //     //http.get(apiUrl + '/solr-index/sync-candidates/?userid=' + candidate._id, callback);
        //     http.get(njsUrl + '/jobseeker/sync-solr?userid=' + data.candidate_id, callback);
        //
        //     console.log(njsUrl + '/jobseeker/sync-solr?userid=' + data.candidate_id);
        // } catch(error){
        //     console.log(error);
        // }
    });

    activateEntrySchema.saveData(data);

    StaffHistory.batchSave(req.body.staff_history);

    res.status(200).send({success:true, result: "Candidate Reactivated!"});

});



router.post("/get-applicant-history", function (req, res, next) {
    var candidate_id = null;
    var data = {};
    if(!req.body.userid)
    {
        return res.status(200).send({success:false, result: "Please check candidate "});
    }

    function delay() {
        return Q.delay(100);
    }


    candidate_id = req.body.userid;
    var deferredPromiseAppHistory = Q.defer();
    var app_historyPromise = [];
    var app_historyArr = [];

    var allPromise = [];
    var output = [];
    // Applicant History
    var applicant_history_fetch_promise =  applicantHistorySchema.getAppHistory(candidate_id);
    applicant_history_fetch_promise.then(function(fetched_applicant_history){

        if(fetched_applicant_history)
        {
            for (var i = 0; i < fetched_applicant_history.length; i++) {

                app_history = fetched_applicant_history[i];
                var admin_promise = app_history.getAdminDetails();
                app_historyPromise.push(admin_promise);
                app_historyPromise.push(delay());
            }

            var allPromise = Q.all(app_historyPromise);
            allPromise.then(function (results) {
                console.log("Promise Done!");

                try{
                    for(var i = 0 ; i < fetched_applicant_history.length ; i++ )
                    {
                        output.push(fetched_applicant_history[i].structureData());
                    }

                    var result = {
                        success: true,
                        data: output
                    };


                    return res.status(200).send(result);
                }catch(e)
                {

                    var result = {
                        success: false,
                        data: e.message
                    };

                    return res.status(200).send(result);
                }

            });

        }
        else
        {
            var result = {
                success: false,
                data: null
            };

            return res.status(200).send(result);
        }


    });
});




router.post("/get-job-staff-history", function (req, res, next) {

    var candidate_id = null;
    var data = {};

    if(!req.body.userid)
    {
        return res.status(200).send({success:false, result: "Please check candidate "});
    }
    if(!req.body.page)
    {
        return res.status(200).send({success:false, result: "Please check requested page number "});
    }
    if(!req.body.limit)
    {
        return res.status(200).send({success:false, result: "Please check page limit "});
    }

    function delay() {
        return Q.delay(100);
    }

    data.userid = req.body.userid;
    data.page = req.body.page;
    data.limit = req.body.limit;
    // candidate_id = req.query.userid;
    var staff_historyPromise = [];
    var output = [];

    var staff_history_fetch_promise =  staffHistorySchema.getStaffHistory(data);
    staff_history_fetch_promise.then(function (fetched_staff_history) {


        if(fetched_staff_history)
        {
            // for (var i = 0; i < fetched_staff_history.length; i++) {
            //
            //     staff_history = fetched_staff_history[i];
            //     var admin_promise = staff_history.getAdminDetails();
            //     staff_historyPromise.push(admin_promise);
            //     staff_historyPromise.push(delay());
            // }

            var allPromise = Q.all(staff_historyPromise);
            allPromise.then(function (results) {
                console.log("Promise Done!");

                try{
                    for(var i = 0 ; i < fetched_staff_history.length ; i++ )
                    {
                        output.push(fetched_staff_history[i].structureData());
                    }

                    var result = {
                        success: true,
                        data: output
                    };

                    return res.status(200).send(result);
                }catch(e)
                {

                    var result = {
                        success: false,
                        data: e.message
                    };

                    return res.status(200).send(result);
                }

            });

        }
        else
        {
            var result = {
                success: false,
                data: null
            };

            return res.status(200).send(result);
        }


    });

});

router.get("/count-staff-history", function (req, res, next) {

    var staff_history_fetch_promise =  staffHistorySchema.countData(req.query.userid);
    staff_history_fetch_promise.then(function (count) {
        var result = {
            success: true,
            data: count
        };

        return res.status(200).send(result);
    });

});



router.post("/add-applicant-history", function (req, res, next) {

    var data = (req.body.apphistData ? req.body.apphistData : null)
    var isUpdate = (req.body.isUpdate ? req.body.isUpdate : false);
    var StaffHistory = require("../mysql/StaffHistory");
    if(data)
    {
        try {

            if(isUpdate)
            {

                applicantHistorySchema.updateAppHistory(data).then(function(result){
                    if(result)
                    {
                        var result = {
                            success: true,
                            data: result
                        };

                        return res.status(200).send(result);
                    }
                    else
                    {
                        var result = {
                            success: false,
                            data: null
                        };

                        return res.status(200).send(result);
                    }

                });
            }
            else
            {
                StaffHistory.batchSave(req.body.staff_history);
                applicantHistorySchema.addAppHisotry(data).then(function(result){
                    if(result)
                    {
                        var result = {
                            success: true,
                            data: result
                        };

                        return res.status(200).send(result);
                    }
                    else
                    {
                        var result = {
                            success: false,
                            data: null
                        };

                        return res.status(200).send(result);
                    }

                });
            }


        }catch(e)
        {
            var result = {
                success: false,
                data: e.message
            };

            return res.status(200).send(result);
        }

    }

});





router.post("/delete-applicant-history", function (req, res, next) {

    var data = (req.body.apphistData ? req.body.apphistData : null);

    if(data)
    {
        try {
            applicantHistorySchema.deleteAppHistory(data).then(function(result){
                if(result)
                {
                    var result = {
                        success: true,
                        data: result
                    };

                    return res.status(200).send(result);
                }
                else
                {
                    var result = {
                        success: false,
                        data: null
                    };

                    return res.status(200).send(result);
                }
            });

        }catch(e)
        {
            var result = {
                success: false,
                data: e.message
            };

            return res.status(200).send(result);
        }

    }
});



router.get("/fetch-job-applications", function (req, res, next) {

    var jobApplicationsSchema = require("../mysql/JobApplication");


    if(!req.query.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }


    jobApplicationsSchema.getActiveJobApplications(req.query.userid).then(function(foundApplications){


        return res.status(200).send({success:true, result:foundApplications});
    });

});

router.get("/fetch-no-show-history", function (req, res, next) {
    if(!req.query.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }


    var staffNoShowSchema = require("../mysql/StaffNoShow");

    staffNoShowSchema.getNoShowHistory(req.query.userid).then(function(foundObjects){


        return res.status(200).send({success:true, result:foundObjects});
    });


});



router.post("/insert-no-show-history", function (req, res, next) {
    if(!req.body.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }

    if(!req.body.no_show_entry){
        return res.status(200).send({success:false, error:"no_show_entry is required!"});
    }

    if(!req.body.staff_history){
        return res.status(200).send({success:false, error:"staff_history is required!"});
    }

    var staffNoShowSchema = require("../mysql/StaffNoShow");
    var StaffHistory = require("../mysql/StaffHistory");

    var no_show_entry = req.body.no_show_entry;

    no_show_entry.userid = parseInt(req.body.userid);


    staffNoShowSchema.insertData(no_show_entry).then(function(saved){

        return res.status(200).send({success:true, result:saved});
    });


    StaffHistory.batchSave(req.body.staff_history);

});

/*
 * Method for Getting Candidate Inactive Status
 * @url http://test.njs.remotestaff.com.au/jobseeker/get-inactive-status/
 *
 */
router.get("/get-inactive-status", function (req, res, next) {

    var inactiveStatusFetchDefer = Q.defer();
    var inactiveStatusFetchPromise = inactiveStatusFetchDefer.promise;
    var inactiveStatusRecord = null;

    var search_key = {};

    if (req.query.userid) {
        var id = parseInt(req.query.userid);
        search_key._id = id;
    } else {
        var result = {success: false};
        return res.status(200).send(result);
    }

    inactiveHistorySchema.getInactiveData(search_key._id).then(function(result){
        if(result){
            if(result.length > 0){
                inactiveStatusRecord = result;
            }
        }
        console.log("inactive status fetch done!");
        inactiveStatusFetchDefer.resolve(true);
    });

    Q.allSettled(inactiveStatusFetchPromise).then(function () {
        return res.status(200).send({success: true, data: inactiveStatusRecord});
    });

});

router.get("/fetch-interview-history", function (req, res, next) {
    if(!req.query.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }


    var tbRequestForInterviewSchema = require("../mysql/InterviewHistory");

    tbRequestForInterviewSchema.getInterviewRecords(req.query.userid).then(function(foundObjects){


        return res.status(200).send({success:true, result:foundObjects});
    });

});

router.get("/fetch-tests-taken", function (req, res, next) {
    if(!req.query.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }


    if(!req.query.email){
        return res.status(200).send({success:false, error:"email is required!"});
    }

    var tests_taken_value = [];


    // //test taken
    var test_taken_fetching_promise = assessmentResultsSchema.getAssessmentResuls(req.query.userid, req.query.email);
    test_taken_fetching_promise.then(function(fetch_assessment_results){
        if(fetch_assessment_results.length > 0){

            fetch_assessment_results.forEach(function(item){
                var current_item = item["dataValues"];
                var current_test_taken = {
                    id: current_item.id,
                    url: current_item.result_url,
                    points: current_item.result_pct,
                    date: current_item.result_date,
                    is_show_resume: false
                };

                if(current_item.assessment_list["dataValues"]){
                    current_test_taken.name = current_item["assessment_list"]["dataValues"]["assessment_title"];
                    var typing = current_item["assessment_list"]["dataValues"]["assessment_title"];

                    current_test_taken.typing = false;
                    if(typing.toLowerCase().search("typing") != -1){
                        current_test_taken.typing = true;
                    }
                }


                if(current_test_taken.typing){
                    if(current_test_taken.points >= 40){
                        if(current_item.result_selected){
                            current_test_taken.is_show_resume = true;
                        }
                    }
                } else{
                    if(current_test_taken.points >= 50){
                        if(current_item.result_selected){
                            current_test_taken.is_show_resume = true;
                        }
                    }
                }

                tests_taken_value.push(current_test_taken);
            });

        }

        return res.status(200).send({success:true, result:tests_taken_value});
    });


    // candidate_details_promises.push(test_taken_fetching_promise);
    // candidate_details_promises.push(delay);

});



router.get("/fetch-last-login", function (req, res, next) {
    if (!req.query.userid) {
        return res.status(200).send({success: false, error: "userid is required!"});
    }


    personalUserLoginSchema.getLastLogin(req.query.userid).then(function(result){
        var last_login_value = null;
        if(result){
            last_login_value = result.last_login;
        }
        return res.status(200).send({success: true, result: last_login_value});

    });
});


router.get("/fetch-profile-completion", function (req, res, next) {
    if (!req.query.userid) {
        return res.status(200).send({success: false, error: "userid is required!"});
    }

    var remoteReadyCriteriaEntrySumPointsSchema = require("../mysql/RemoteReadyCriteriaEntrySumPoints");

    remoteReadyCriteriaEntrySumPointsSchema.getRemoteReadyData(req.query.userid).then(function(result){
        var points = 0;
        if(result){
            points = parseInt(result.dataValues.points);
        }

        var percentage = points;

        if(percentage > 100){
            percentage = 100;
        }

        if(percentage < 0){
            percentage = 0;
        }

        return res.status(200).send({success: true, result: percentage});
    });

});


//check if email already exists
router.get("/check-email", function (req, res, next) {

    var email = (req.query.email ? req.query.email : null);

    var result={success:false,data:null};

    if(email)
    {
        personalInfoSchema.checkEmailIfExist(email).then(function(count){
            result = {
                success:true,
                data:count
            }

            return res.status(200).send(result);
        });

    }
    else
    {
        return res.status(200).send(result);
    }



});




//check if email already exists
router.get("/get-referred-by", function (req, res, next) {

    var userid = (req.query.userid ? req.query.userid : null);

    var result={success:false,result:null};

    if(userid)
    {
        personalInfoSchema.getReferredBy(userid).then(function(found_referred_by_details){
            result = {
                success:true,
                result:found_referred_by_details
            }

            return res.status(200).send(result);
        });

    }
    else
    {
        return res.status(200).send(result);
    }



});




module.exports = router;