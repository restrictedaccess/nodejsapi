/**
 * Created by joenefloresca on 19/01/2017.
 */
var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var env = require("../config/env");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var jobseekerSchema = require("../models/Jobseeker");
var recruiterStaffSchema = require("../mysql/RecruiterStaff");


var candidatesQueue = require("../bull/candidates_queue");

var multiProcessQueue = require("../bull/cluster_process");
var candidatesProcessDef = require("../bull/candidates");

var asl_candidates_queue = require("../bull/asl_candidates_queue");
var asl_uploadvoice_queue = require("../bull/asl_uploadvoice_queue");
var asl_fileuploads_queue = require("../bull/asl_fileuploads_queue");
var asl_uploadsamplework_queue = require("../bull/asl_uploadsamplework_queue");

var http = require("http");
http.post = require('http-post');



var sha1 = require('locutus/php/strings/sha1');

//handling file
var multer  = require('multer');
var upload = multer({ dest: '../uploads/'});
var type = upload.any();




router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

function supportCrossOriginScript(req, res, next) {
    res.status(200);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
}

/**
 *  Check first if candidate is already categorized before proceeding with the post request
 *
 */
router.post("/^((?!upload).)*$/s", function(req,res,next){

    if(!req.body.candidate){
        return res.status(200).send({success: false, error: "candidate is required!"});
    }

    if(!req.body.logged_in_user){
        return res.status(200).send({success: false, error: "logged_in_user is required!"});
    }

    var candidate = req.body.candidate;
    var logged_in_user = req.body.logged_in_user;

    if(!candidate._id){
        candidate = JSON.parse(candidate);
    }

    if(!logged_in_user.id){
        logged_in_user = JSON.parse(logged_in_user);
    }

    var JobSubCategoryApplicants = require("../mysql/JobSubCategoryApplicants");
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
    var Jobseeker = db.model("Jobseeker", jobseekerSchema);

    db.once("open", function(){
        if(logged_in_user.user_type == "USER"){
            JobSubCategoryApplicants.getCategoriesByRatings(candidate._id, 0).then(function(categories){
                if(categories){
                    if(categories.length > 0){

                        Jobseeker.findOne({_id:candidate._id}).lean().exec(function(err, foundDoc){

                            db.close();

                            return res.status(200).send({success: false, error: "candidate_shown_in_website", result:foundDoc});
                        });

                    } else{
                        db.close();
                        next();
                    }
                }else {
                    db.close();
                    next();
                }
            });
        } else{
            db.close();
            next();
        }

    });



});

//router.options('/save', supportCrossOriginScript);

/**
 * Saves candidate details to prod -> candidates_asl (mongo) and candidate related tables in mysql
 *
 * @param candidate The candidate to be saved (mongo, mysql)
 * @param staff_history The history to be saved in mysql
 *
 * @returns json object with success property
 */
router.post("/save", function(req,res,next){
    function delay(){ return Q.delay(100); }
    if(!req.body.candidate){
        return res.status(200).send({success: false, error: "candidate is required!"});
    }
    var JobSubCategoryApplicants = require("../mysql/JobSubCategoryApplicants");
    var StaffHistory = require("../mysql/StaffHistory");
    var StaffTimezone = require("../mysql/StaffTimezone");
    var StaffRate = require("../mysql/StaffRate");
    var Skill = require("../mysql/Skill");
    var EvaluationComments = require("../mysql/EvaluationComments");
    var Language = require("../mysql/Language");
    var Currentjob = require("../mysql/Currentjob");
    var Personal_Info = require("../mysql/Personal_Info");
    var Education = require("../mysql/Education");
    var Evaluation = require("../mysql/Evaluation");
    var StaffSkypes = require("../mysql/StaffSkypes");
    var AssessmentResult = require("../mysql/AssessmentResult");
    var PersonalWorkingModel = require("../mysql/PersonalWorkingModel");
    var CharacterReference = require("../mysql/CharacterReference");
    var ActivateEntry = require("../mysql/ActivateEntry");

    var candidate = req.body.candidate;
    var staff_history = req.body.staff_history;


    candidate.dateupdated = configs.getDateToday();
    candidate.dateUpdated = configs.getDateToday();

    var focus_save = [];

    var mysql_save_promises = [];

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
    var Jobseeker = db.model("Jobseeker", jobseekerSchema);
    var search_key = {"_id" : candidate._id};

    var allAslJobSeekerFirstUpdate = [];


    var willFulfillJobseekerDeferred = Q.defer();
    var willFulfillJobseeker = willFulfillJobseekerDeferred.promise;
    allAslJobSeekerFirstUpdate.push(willFulfillJobseeker);
    allAslJobSeekerFirstUpdate.push(delay);


    var allSaveMysqlPromises = [];

    var characterReferenceSaveMysqlDefered = Q.defer();
    var characterReferenceSaveMysqlPromise = characterReferenceSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(characterReferenceSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var characterReferenceDeleteMysqlDefered = Q.defer();
    var characterReferenceDeleteMysqlPromise = characterReferenceDeleteMysqlDefered.promise;
    allSaveMysqlPromises.push(characterReferenceDeleteMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var categoryEntriesSaveMysqlDefered = Q.defer();
    var categoryEntriesSaveMysqlPromise = categoryEntriesSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(categoryEntriesSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var personalSaveMysqlDefered = Q.defer();
    var personalSaveMysqlPromise = personalSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(personalSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var recruiterStaffSaveMysqlDefered = Q.defer();
    var recruiterStaffSaveMysqlPromise = recruiterStaffSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(recruiterStaffSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var skillsSaveMysqlDefered = Q.defer();
    var skillsSaveMysqlPromise = skillsSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(skillsSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var skillsDeleteMysqlDefered = Q.defer();
    var skillsDeleteMysqlPromise = skillsDeleteMysqlDefered.promise;
    allSaveMysqlPromises.push(skillsDeleteMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var evalNotesSaveMysqlDefered = Q.defer();
    var evalNotesSaveMysqlPromise = evalNotesSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(evalNotesSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var evalNotesDeleteMysqlDefered = Q.defer();
    var evalNotesDeleteMysqlPromise = evalNotesDeleteMysqlDefered.promise;
    allSaveMysqlPromises.push(evalNotesDeleteMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var languagesSaveMysqlDefered = Q.defer();
    var languagesSaveMysqlPromise = languagesSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(languagesSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var languagesDeleteMysqlDefered = Q.defer();
    var languagesDeleteMysqlPromise = languagesDeleteMysqlDefered.promise;
    allSaveMysqlPromises.push(languagesDeleteMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var educationSaveMysqlDefered = Q.defer();
    var educationSaveMysqlPromise = educationSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(educationSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var staffHistorySaveMysqlDefered = Q.defer();
    var staffHistorySaveMysqlPromise = staffHistorySaveMysqlDefered.promise;
    allSaveMysqlPromises.push(staffHistorySaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var positionsDesiredSaveMysqlDefered = Q.defer();
    var positionsDesiredbSaveMysqlPromise = positionsDesiredSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(positionsDesiredbSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var currentjobSaveMysqlDefered = Q.defer();
    var currentjobSaveMysqlPromise = currentjobSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(currentjobSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var evaluationSaveMysqlDefered = Q.defer();
    var evaluationSaveMysqlPromise = evaluationSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(evaluationSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var staffTimezoneSaveMysqlDefered = Q.defer();
    var staffTimezoneSaveMysqlPromise = staffTimezoneSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(staffTimezoneSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var staffRateSaveMysqlDefered = Q.defer();
    var staffRateSaveMysqlPromise = staffRateSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(staffRateSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var availableStatusSaveMysqlDefered = Q.defer();
    var availableStatusSaveMysqlPromise = availableStatusSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(availableStatusSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var assessmentResultSaveMysqlDefered = Q.defer();
    var assessmentResultSaveMysqlPromise = assessmentResultSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(assessmentResultSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);

    var workingModelSaveMysqlDefered = Q.defer();
    var workingModelSaveMysqlPromise = workingModelSaveMysqlDefered.promise;
    allSaveMysqlPromises.push(workingModelSaveMysqlPromise);
    allSaveMysqlPromises.push(delay);


    var removeActivatedEntryMysqlDefered = Q.defer();
    var removeActivatedEntryPromise = removeActivatedEntryMysqlDefered.promise;
    allSaveMysqlPromises.push(removeActivatedEntryPromise);
    allSaveMysqlPromises.push(delay);



    db.once('open', function(){

        function updateMongoJobseekerDoc(data, callback){
            Jobseeker.update(search_key, {$set: data}, {upsert: true}, callback);

        }


        console.log("jobseeker saving start");
        Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
            if (err) {
                db.close();
                willFulfillJobseekerDeferred.resolve(null);
                //return res.status(200).send({success: false, error: err});
            }

            if(foundDoc){
                //update
                try{
                    delete candidate._id;
                } catch(major_error){
                    console.log("Error updating first try");
                    console.log(major_error);
                }

                updateMongoJobseekerDoc(candidate, function(err){
                    if(err){
                        willFulfillJobseekerDeferred.resolve(null);
                        return res.status(200).send({success: false, error: err});
                    }
                    willFulfillJobseekerDeferred.resolve(foundDoc);
                    if(typeof candidate.jobseeker_save == "undefined" && typeof candidate.asl_mode == "undefined"){
                        res.status(200).send({success: true, result: candidate});
                    }
                });
            } else{
                //insert
                foundDoc = new Jobseeker(candidate);

                foundDoc.save(function(err){
                    if (err){
                        willFulfillJobseekerDeferred.resolve(null);
                        return res.status(200).send({success: false, error: err});
                    }
                    willFulfillJobseekerDeferred.resolve(foundDoc);
                    if(typeof candidate.jobseeker_save == "undefined" && typeof candidate.asl_mode == "undefined"){
                        res.status(200).send({success: true, result: candidate});
                    }
                });

            }
        });



        var allMongoPromises = Q.allSettled(allAslJobSeekerFirstUpdate);

        allMongoPromises.then(function (results) {
            console.log("saved jobseeker and asl (optional) to mongo first!");



            // if(typeof candidate.jobseeker_save == "undefined"){


            function syncEvaluationCommentsFromMysqlToMongo(){
                if(typeof candidate.evaluation_comments != "undefined"){
                    Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
                        if(foundDoc){
                            foundDoc.evaluationCommentsBatchSave(search_key._id).then(function(result){
                                if(result){
                                    var all_saving = [];


                                    var saveJobseekerDeferred = Q.defer();
                                    var saveJobseekerPromise = saveJobseekerDeferred.promise;
                                    all_saving.push(delay);
                                    all_saving.push(saveJobseekerPromise);
                                    all_saving.push(delay);

                                    updateMongoJobseekerDoc(result, function(err){
                                        console.log("eval notes saved jobseeker!");
                                        //evalNotesSaveMysqlDefered.resolve(result);
                                        //call second process
                                        //syncSkillsFromMysqlToMongo();
                                        if (err){
                                            console.log(err);
                                        }
                                        saveJobseekerDeferred.resolve(true);
                                    });

                                    var allSyncPromises = Q.allSettled(all_saving);
                                    allSyncPromises.then(function (results) {
                                        console.log("saved asl (optional) and jobseeker eval notes");
                                        //call second process
                                        evalNotesSaveMysqlDefered.resolve(result);
                                        syncSkillsFromMysqlToMongo();
                                    });
                                }
                            });

                        }
                    });
                } else{

                    console.log("eval notes NOT saved!");
                    evalNotesSaveMysqlDefered.resolve(null);
                    //call second process
                    syncSkillsFromMysqlToMongo();
                }

            }

            function syncSkillsFromMysqlToMongo(){
                if(typeof candidate.skills != "undefined"){
                    Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
                        if(foundDoc){
                            foundDoc.skillsBatchSave(search_key._id).then(function(result){
                                if(result){

                                    var all_saving = [];

                                    var saveJobseekerDeferred = Q.defer();
                                    var saveJobseekerPromise = saveJobseekerDeferred.promise;
                                    all_saving.push(delay);
                                    all_saving.push(saveJobseekerPromise);
                                    all_saving.push(delay);


                                    updateMongoJobseekerDoc(result, function(err){
                                        console.log("skills saved! jobseeker");
                                        //skillsSaveMysqlDefered.resolve(result);
                                        //call second process
                                        if (err){
                                            console.log(err);
                                        }
                                        saveJobseekerDeferred.resolve(true);
                                    });

                                    var allSyncPromises = Q.allSettled(all_saving);
                                    allSyncPromises.then(function (results) {
                                        console.log("saved asl (optional) and jobseeker skills");

                                        //call second process
                                        skillsSaveMysqlDefered.resolve(result);
                                        syncLanguagesFromMysqlToMongo();
                                    });
                                }
                            });

                        }

                    });
                } else{

                    console.log("skills NOT saved!");
                    skillsSaveMysqlDefered.resolve(null);
                    //call second process
                    syncLanguagesFromMysqlToMongo();
                }

            }


            function syncLanguagesFromMysqlToMongo(){
                if(typeof candidate.languages != "undefined"){
                    Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
                        if(foundDoc){
                            foundDoc.languagesBatchSave(search_key._id).then(function(result){
                                if(result){

                                    var all_saving = [];

                                    var saveJobseekerDeferred = Q.defer();
                                    var saveJobseekerPromise = saveJobseekerDeferred.promise;
                                    all_saving.push(delay);
                                    all_saving.push(saveJobseekerPromise);
                                    all_saving.push(delay);

                                    updateMongoJobseekerDoc(result, function(err){
                                        console.log("languages saved! jobseeker");
                                        //languagesSaveMysqlDefered.resolve(result);
                                        //call second process
                                        if (err){
                                            console.log(err);
                                        }
                                        saveJobseekerDeferred.resolve(true);
                                    });

                                    var allSyncPromises = Q.allSettled(all_saving);
                                    allSyncPromises.then(function (results) {
                                        syncCategoriesFromMysqlToMongo();
                                        languagesSaveMysqlDefered.resolve(result);
                                        console.log("saved asl (optional) and jobseeker language");
                                    });
                                }
                            });

                        }

                    });
                } else{

                    console.log("languages NOT saved!");
                    languagesSaveMysqlDefered.resolve(null);
                    syncCategoriesFromMysqlToMongo();
                }

            }


            function syncCategoriesFromMysqlToMongo(){
                if(typeof candidate.categorization_entries != "undefined"){
                    Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
                        if(foundDoc){
                            foundDoc.categoriesBatchSave(search_key._id).then(function(result){
                                if(result){

                                    var all_saving = [];

                                    var saveJobseekerDeferred = Q.defer();
                                    var saveJobseekerPromise = saveJobseekerDeferred.promise;
                                    all_saving.push(delay);
                                    all_saving.push(saveJobseekerPromise);
                                    all_saving.push(delay);

                                    updateMongoJobseekerDoc(result, function(err){

                                        //languagesSaveMysqlDefered.resolve(result);
                                        //call second process
                                        if (err){
                                            console.log(err);
                                        }

                                        console.log("categories saved! jobseeker");
                                        saveJobseekerDeferred.resolve(true);

                                    });

                                    var allSyncPromises = Q.allSettled(all_saving);
                                    allSyncPromises.then(function (results) {
                                        syncCharacterReferencesFromMysqlToMongo();
                                        console.log("saved asl (optional) and jobseeker categories");
                                        categoryEntriesSaveMysqlDefered.resolve(result);
                                    });
                                }
                            });

                        }

                    });
                } else{

                    console.log("categories NOT saved!");
                    categoryEntriesSaveMysqlDefered.resolve(null);
                    syncCharacterReferencesFromMysqlToMongo();
                }

            }


            function syncCharacterReferencesFromMysqlToMongo(){
                if(typeof candidate.character_references != "undefined"){
                    Jobseeker.findOne(search_key).select({_id:0}).exec(function(err, foundDoc){
                        if(foundDoc){
                            foundDoc.characterReferencesBatchSave(search_key._id).then(function(result){
                                if(result){

                                    var all_saving = [];

                                    var saveJobseekerDeferred = Q.defer();
                                    var saveJobseekerPromise = saveJobseekerDeferred.promise;
                                    all_saving.push(delay);
                                    all_saving.push(saveJobseekerPromise);
                                    all_saving.push(delay);

                                    updateMongoJobseekerDoc(result, function(err){

                                        //languagesSaveMysqlDefered.resolve(result);
                                        //call second process
                                        if (err){
                                            console.log(err);
                                        }

                                        console.log("character_references saved! jobseeker");
                                        saveJobseekerDeferred.resolve(true);

                                    });

                                    var allSyncPromises = Q.allSettled(all_saving);
                                    allSyncPromises.then(function (results) {
                                        // syncStaffSkypesFromMysqlToMongo();
                                        console.log("saved asl (optional) and jobseeker character_references");
                                        characterReferenceSaveMysqlDefered.resolve(result);
                                    });
                                }
                            });

                        }

                    });
                } else{

                    console.log("character_references NOT saved!");
                    characterReferenceSaveMysqlDefered.resolve(null);
                }

            }




            syncEvaluationCommentsFromMysqlToMongo();
         

        });

    });

    if(!req.body.recently_activated){
        ActivateEntry.removeActivatedEntries(req.body.candidate._id).then(function(result){
            removeActivatedEntryMysqlDefered.resolve(true);
        });
    } else{
        removeActivatedEntryMysqlDefered.resolve(true);
    }



    if(candidate.computer_hardwares){
        candidate.computer_hardware = Personal_Info.evaluatComputerHardware(candidate.computer_hardwares);
        console.log(candidate.computer_hardware);
        console.log("computer_hardwares SAVED!");
    } else{
        console.log("computer_hardwares NOT SAVED!");
    }


    //save Personal information
    Personal_Info.saveInfo(candidate).then(function(result){
        console.log("personal info saved!");
        personalSaveMysqlDefered.resolve({success:true});
    });





    if(candidate.recruiter && candidate.recruiter.id){
        try{
            recruiterStaffSchema.getRecruiter(search_key._id, parseInt(candidate.recruiter.id)).then(function(recruiterStaffFound){
                if(recruiterStaffFound){
                    //if found recruiter candidate combination
                    //do nothing
                    console.log("recruiter is the same!");
                    recruiterStaffSaveMysqlDefered.resolve(true);
                } else{
                    //if recruiter candidate combination is not found
                    //remove previous recruiter_staff of candidate
                    //then save this recruiter candidate combination

                    recruiterStaffSchema.assignRecruiterToCandidate(search_key._id, candidate.recruiter.id).then(function(result){
                        console.log("recruiter updated!");
                        recruiterStaffSaveMysqlDefered.resolve(true);
                    });

                }

            });
        } catch(error){
            console.log("Error recruiter_staff");
            console.log(error);
        }

    } else{
        console.log("recruiter_staff NOT saved!");
        recruiterStaffSaveMysqlDefered.resolve(false);
    }




    if(candidate.evaluation){

        try{
            Evaluation.saveData(candidate.evaluation, search_key._id).then(function(result){
                console.log("evaluation saved");
                evaluationSaveMysqlDefered.resolve(true);
            });
        } catch(error){
            console.log("Error Evaluation saving");
            console.log(error);
        }

    } else{
        console.log("evaluation NOT saved!");
        evaluationSaveMysqlDefered.resolve(false);
    }


    if(candidate.working_model){

        PersonalWorkingModel.saveData(candidate.working_model, search_key._id).then(function(result){
            console.log("working_model saved");
            workingModelSaveMysqlDefered.resolve(true);
        });

    } else{
        console.log("working_model NOT saved!");
        workingModelSaveMysqlDefered.resolve(false);
    }





    if(candidate.full_time_availability_timezone || candidate.part_time_availability_timezone){
        var full_timezone_str = "";
        var part_timezone_str = "";
        if(candidate.full_time_availability_timezone.length > 0){
            full_timezone_str = candidate.full_time_availability_timezone.join();
        }

        if(candidate.part_time_availability_timezone.length > 0){
            part_timezone_str = candidate.part_time_availability_timezone.join();
        }

        StaffTimezone.saveData({time_zone: full_timezone_str, p_timezone: part_timezone_str}, search_key._id).then(function(result){
            console.log("timezone SAVED!");
            staffTimezoneSaveMysqlDefered.resolve(true);
        });


    } else{
        console.log("timezone NOT saved");
        staffTimezoneSaveMysqlDefered.resolve(false);
    }


    if(candidate.staff_rate){
        StaffRate.saveData(candidate.staff_rate, search_key._id).then(function(result){
            console.log("staff rate SAVED");
            staffRateSaveMysqlDefered.resolve(true);
        });
    } else{
        console.log("staff rate NOT saved");
        staffRateSaveMysqlDefered.resolve(false);
    }


    if(candidate.availability_status){
        Currentjob.saveData(candidate.availability_status, search_key._id).then(function(result){
            console.log("availability status saved");
            availableStatusSaveMysqlDefered.resolve(true);
        });
    } else{
        console.log("availability status NOT saved");
        availableStatusSaveMysqlDefered.resolve(false);
    }


    if(candidate.tests_taken){
        AssessmentResult.batchSave(candidate.tests_taken).then(function(result){
            console.log("tests_taken status saved");
            assessmentResultSaveMysqlDefered.resolve(true);
        });
    } else{
        console.log("tests_taken status NOT saved");
        assessmentResultSaveMysqlDefered.resolve(false);
    }


    //save Education Info
    if(typeof candidate.education != "undefined"){
        candidate.education.userid = search_key._id;
        Education.saveInfo(candidate.education).then(function(result){
            console.log("education saved!");
            educationSaveMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("education not saved");
        educationSaveMysqlDefered.resolve({success:true});
    }


    function savePositionsDesired(){
        //Save positions_desired to currentjob
        if(candidate.positions_desired){
            Currentjob.savePositionsDesired(candidate.positions_desired, search_key._id).then(function(result){
                console.log("positions_desired updated!");
                positionsDesiredSaveMysqlDefered.resolve({success:true});
            });
        } else{
            console.log("NO positions_desired to save!");
            positionsDesiredSaveMysqlDefered.resolve({success:true});
        }
    }




    //Save employment_hsitory to currentjob
    if(candidate.employment_history){
        Currentjob.batchSave(candidate.employment_history, search_key._id).then(function(result){
            console.log("currentjob updated!");
            savePositionsDesired();
            currentjobSaveMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("NO employment_history to save!");
        savePositionsDesired();
        currentjobSaveMysqlDefered.resolve({success:true});
    }

    //delete skills
    if(candidate.skills_to_delete){
        Skill.batchDelete(candidate.skills_to_delete).then(function(result){
            console.log("skill deleted!");
            skillsDeleteMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("NO skills to delete!");
        skillsDeleteMysqlDefered.resolve({success:true});
    }


    //delete skills
    if(candidate.character_references_to_delete){
        CharacterReference.batchDelete(candidate.character_references_to_delete).then(function(result){
            console.log("character references deleted!");
            characterReferenceDeleteMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("NO character references to delete!");
        characterReferenceDeleteMysqlDefered.resolve({success:true});
    }



    //delete evaluation_comments
    if(candidate.evaluation_comments_to_delete){
        EvaluationComments.batchDelete(candidate.evaluation_comments_to_delete).then(function(result){
            console.log("eval notes deleted!");
            evalNotesDeleteMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("NO eval_comments to delete!");
        evalNotesDeleteMysqlDefered.resolve({success:true});
    }

    //delete languages
    if(candidate.languages_to_delete){
        Language.batchDelete(candidate.languages_to_delete).then(function(result){
            console.log("languages deleted!");
            languagesDeleteMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("NO languages to delete!");
        languagesDeleteMysqlDefered.resolve({success:true});
    }


    if(staff_history.length > 0){
        StaffHistory.batchSave(staff_history).then(function(result){
            console.log("staff_history saved!");
            staffHistorySaveMysqlDefered.resolve({success:true});
        });
    } else{
        console.log("staff_history NOT saved!");
        staffHistorySaveMysqlDefered.resolve({success:true});
    }




    var allPromises = Q.allSettled(allSaveMysqlPromises);
    allPromises.then(function(results){
        console.log("All mysql save Promises done!");
        if(typeof candidate.jobseeker_save != "undefined" || typeof candidate.asl_mode != "undefined"){
            console.log("resolved after saving jobseeker!");

            Jobseeker.findOne(search_key).lean().exec(function(err, foundDoc){

                db.close();

                res.status(200).send({success: true, result: foundDoc});
            });
        } else{

            db.close();
        }

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
            console.log(njsUrl + '/jobseeker/sync-solr/?userid=' + search_key._id);

            //http.get(apiUrl + '/solr-index/sync-candidates/?userid=' + search_key._id, callback);
            http.get(njsUrl + '/jobseeker/sync-solr/?userid=' + search_key._id, callback);



        } catch(error){
            console.log("Error trying to sync to solr");
            console.log(error);
        }


        try{
            var https_api = require("http");
            if(env.environment == "production"){
                https_api = require("https");
            }

            console.log(apiUrl + '/solr-index/sync-asl/?userid=' + search_key._id);

            https_api.get(apiUrl + '/solr-index/sync-asl/?userid=' + search_key._id, callback);

        } catch(error){
            console.log("Error calling solr-index/sync-asl");
            console.log(error);
        }


    });

});



/**
 * Uploads Img
 *
 * @param candidate The details of the candidate
 * @file personalVoice The voice to be uploaded
 */
router.post("/upload-img", type, function(req,res,next){

    asl_fileuploads_queue.add({
        body: req.body,
        files: req.files
    });

    return res.status(200).send({success:true,result:"uploading files"});
});


/**
 * Uploads voice
 *
 * @link /asl/upload-voice
 *
 * @param candidate The details of the candidate
 * @param staff_history The staff history
 * @file personalVoice The voice to be uploaded
 */
router.post("/upload-voice", type, function(req,res,next){

    asl_uploadvoice_queue.add({
        body: req.body,
        files: req.files
    });

    return res.status(200).send({success:true,result:"uploading voice files"});
});



/**
 * Uploads voice
 *
 * @link /asl/upload-sample-work
 *
 * @param candidate The details of the candidate
 * @param staff_history The staff history
 * @file sampleWork The voice to be uploaded
 */
router.post("/upload-sample-work", type, function(req,res,next){

    asl_uploadsamplework_queue.add({
        body: req.body,
        files: req.files
    });

    return res.status(200).send({success:true,result:"uploading files"});

});


/**
 * Fetch voice for rendering
 * @param candidate The details of candidate
 */
router.get("/fetch-voice", function(req,res,next){
    if(!req.query.userid){
        return res.status(200).send({success: false, error: "userid is required!"});
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var candidatesFileUploadsSchema = require("../models/CandidatesFileUploads");
    var CandidatesFileUploads = db.model("CandidatesFileUploads", candidatesFileUploadsSchema);
    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;



    db.once('open', function () {
        gfs = Grid(db.db);
        CandidatesFileUploads.findOne({userid:req.query.userid, file_type: "AUDIO"}).exec(function(err, existingRecord){


            if(existingRecord){

                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db.close();
                        return res.status(400).send(err);
                    }
                    else if (!file) {
                        db.close();
                        return res.status(404).send('Error on the database looking for the file.');
                    }


                    res.set('Content-Type', file.contentType);
                    //res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //
                    readstream.on("error", function (err) {

                        console.log(err);
                        res.end();
                        db.close();
                    });
                    readstream.pipe(res);

                });
            } else{
                return res.status(200).send({success: false, error: "No audio found!"});
            }

        });
    });

});



/**
 * Fetch image for rendering
 * @param candidate The details of candidate
 */
router.get("/fetch-image", function(req,res,next){
    if(!req.query.userid){
        return res.status(200).send({success: false, error: "userid is required!"});
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var candidatesFileUploadsSchema = require("../models/CandidatesFileUploads");
    var CandidatesFileUploads = db.model("CandidatesFileUploads", candidatesFileUploadsSchema);
    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;

    db.once('open', function() {
        gfs = Grid(db.db);


    });

    db.once('open', function () {
        gfs = Grid(db.db);
        CandidatesFileUploads.findOne({userid:req.query.userid, file_type: "IMAGE"}).exec(function(err, existingRecord){


            if(existingRecord){
                console.log("record");
                console.log(existingRecord);


                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db.close();
                        return res.status(400).send(err);
                    }
                    else if (!file) {
                        db.close();
                        return res.status(404).send('Error on the database looking for the file.');
                    }


                    res.set('Content-Type', file.contentType);
                    //res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //
                    readstream.on("error", function (err) {

                        console.log(err);
                        res.end();
                        db.close();
                    });
                    readstream.pipe(res);

                });
            } else{
                return res.status(200).send({success: false, error: "No image found!"});
            }

        });
    });

});




/**
 * Fetch sample work for rendering
 * @param candidate The details of candidate
 */
router.get("/fetch-sample-work", function(req,res,next){
    if(!req.query.userid){
        return res.status(200).send({success: false, error: "userid is required!"});
    }

    if(!req.query.filename){
        return res.status(200).send({success: false, error: "filename is required!"});
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var candidatesFileUploadsSchema = require("../models/CandidatesFileUploads");
    var CandidatesFileUploads = db.model("CandidatesFileUploads", candidatesFileUploadsSchema);
    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;



    db.once('open', function () {
        gfs = Grid(db.db);
        CandidatesFileUploads.findOne({userid:req.query.userid, filename: req.query.filename}).exec(function(err, existingRecord){


            if(existingRecord){

                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db.close();
                        return res.status(400).send(err);
                    }
                    else if (!file) {
                        db.close();
                        return res.status(404).send('Error on the database looking for the file.');
                    }


                    res.set('Content-Type', file.contentType);
                    res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //
                    readstream.on("error", function (err) {

                        console.log(err);
                        res.end();
                        db.close();
                    });
                    readstream.pipe(res);

                });
            } else{
                return res.status(200).send({success: false, error: "No sample work found!"});
            }

        });
    });

});



/**
 * Fetch status of candidate whether displayed on website (true) or not (false)
 * @link /asl/get-website-display-state
 *
 * @param userid The id of the candidate
 */
router.get("/get-website-display-state", function(req,res,next){
    if(!req.query.userid){
        return res.status(200).send({success: false, error: "userid is required!"});
    }

    var JobSubCategoryApplicants = require("../mysql/JobSubCategoryApplicants");


    JobSubCategoryApplicants.getCategoriesByRatings(req.query.userid, 0).then(function(categories){
        if(categories.length > 0){
            //true
            return res.status(200).send({success: true, displayState:true});
        } else{
            //false
            return res.status(200).send({success: true, displayState:false});
        }
    })
});



/**
 * Removes applicant file
 *
 * @link /asl/remove-sample-work
 *
 * @param applicant_file_to_delete The details of the applicant file to delete
 * @param candidate The details The candidate
 * @param staff_history The staff history
 */
router.post("/remove-sample-work", function(req,res,next){

    if(!req.body.candidate){
        return res.status(200).send({success: false, error: "candidate is required!"});
    }

    if(!req.body.staff_history){
        return res.status(200).send({success: false, error: "staff_history is required!"});
    }

    if(!req.body.applicant_file_to_delete){
        return res.status(200).send({success: false, error: "applicant_file_to_delete is required!"});
    }


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var gridFSSchema = require("../models/CandidatesFileUploads");
    var GridFsUpload = db.model("GridFsUpload", gridFSSchema);
    var StaffHistory = require("../mysql/StaffHistory");
    var Personal_Info = require("../mysql/Personal_Info");
    var ApplicantFile = require("../mysql/ApplicantFile");

    var candidate = req.body.candidate;
    var staff_history = req.body.staff_history;
    var path = configs.getTmpFolderPath();


    //html file
    var sample_work_filename = req.body.applicant_file_to_delete.name;

    //save to tb_applicant_files
    var applicant_file_to_delete = req.body.applicant_file_to_delete;
    applicant_file_to_delete.userid = candidate.id;
    ApplicantFile.removeFile(applicant_file_to_delete).then(function(removedFile){
        res.status(200).send(removedFile);
    });


    db.once('open', function () {
        GridFsUpload.findOne({userid:candidate.id, filename: sample_work_filename}).exec(function(err, existingRecord){

            if(existingRecord){
                console.log("record found!");
                new_grid_fs = existingRecord;

                new_grid_fs.removeFile(sample_work_filename, candidate).then(function(gridRemoveResult){

                    GridFsUpload.remove({ _id: new_grid_fs._id }, function (err) {
                        if (err) return handleError(err);
                        db.close();
                        // removed!
                    });
                    //res.status(200).send({success: true, result: gridSaveResult});
                });
            }

        });
    });

    StaffHistory.batchSave(staff_history);

    //return res.status(200).send({success: true, result: req.body});
});


router.get("/get-rec",function(req,res,next){

   var userid = (req.query.userid ? req.query.userid : null );
   var rec_id =  (req.query.rec_id ? req.query.rec_id : null );


    if(!userid && rec_id)
    {
        return res.status(200).send({success:false,msg:"Can't get recruiter details"});
    }


    recruiterStaffSchema.getRecruiter(userid, parseInt(rec_id)).then(function(recruiterStaffFound){

        var data = {};
        if(recruiterStaffFound)
        {
            data.signature_contact_nos = (recruiterStaffFound.signature_contact_nos ? recruiterStaffFound.signature_contact_nos : null);
            data.signature_company = (recruiterStaffFound.signature_company ? recruiterStaffFound.signature_company : null);
        }
        return res.status(200).send({success:true,data:data});
    });

});


router.get("/sync-all-candidate-files",function(req,res,next){

    if(!req.query.userid){
        return res.status(200).send({success:false,error:"userid is required"});
    }

    var queue = require("../bull/candidates_files_queue");


    var candidate = {
        id: parseInt(req.query.userid),
    };


    queue.queue.add({processCandidate:candidate});

    queue.promise.then(function(results){
        return res.status(200).send({success:true,result:results});
    });



});




router.get("/save-asl-history",function(req,res,next){

    if(!req.query.candidate_id){
        return res.status(200).send({success:false,error:"candidate_id is required"});
    }

    var history = req.query;

    var jobSubCategoryApplicantHistorySchema = require("../mysql/JobSubCategoryApplicantHistory");

    jobSubCategoryApplicantHistorySchema.saveHistory(history).then(function(savedResult){
        return res.status(200).send({success:true,result:savedResult});
    });

});



router.get("/sync-all-asl-candidates-solr",function(req,res,next){


    asl_candidates_queue.add({candidate_id: 102549});

    return res.status(200).send({success:true,result:"syncing all asl candidates"});

});






module.exports = router;
