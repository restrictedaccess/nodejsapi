/**
 * Created by joenefloresca on 19/01/2017.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var skillsSchema = require("../mysql/Skill");
var evaluationCommentsSchema = require("../mysql/EvaluationComments");
var languagesSchema = require("../mysql/Language");
var jobSubCategoryApplicantsSchema = require("../mysql/JobSubCategoryApplicants");
var staffSkypesSchema = require("../mysql/StaffSkypes");
var characterReferencesSchema = require("../mysql/CharacterReference");
var aslCategorizationEntry = require("../models/AslCategorizationEntry");

var fields = {
    _id:{type:Number},
    birth_date:{type:Date},
    availability_str:{type:String},
    availability_status:{
        aday:{type:String},
        amonth:{type:String},
        available_notice:{type:String},
        available_notice_duration:{type:String},
        available_status:{type:String},
        ayear:{type:String},
        years_worked:{type:String},
    },
    education:{
        college_country:{type:String},
        college_name:{type:String},
        educationallevel:{type:String},
        fieldstudy:{type:String},
        gpascore:{type:String},
        grade:{type:String},
        graduate_month:{type:String},
        graduate_year:{type:String},
        id:{type:Number},
        licence_certification:{type:String},
        major:{type:String},
        trainings_seminars:{type:String}
    },
    email:{type:String},
    employment_history:{type:Array},
    evaluation_comments:{type:Array},
    first_name:{type:String},
    gender:{type:String},
    image:{type:String},
    languages:{type:Array},
    full_time_availability_timezone:{type:Array},
    part_time_availability_timezone:{type:Array},
    full_time_rates:{type:Array},
    part_time_rates:{type:Array},
    full_time_rates_id:{type:Number},
    part_time_rates_id:{type:Number},
    full_time_negotiable : {type:String},
    part_time_negotiable: {type:String},
    tests_taken:{type:Array},
    last_name:{type:String},
    latest_job_title:{type:String},
    nationality:{type:String},
    no_show_entires:{type:Array},
    recruiter:{
        first_name:{type:String},
        id:{type:Number},
        last_name:{type:String},
        email:{type:String},
        contact_nos:{type:String},
        company:{type:String}
    },
    permanent_residence_obj:{
        name:{type:String},
        sortname:{type:String},
    },
    skills:{type:Array},
    top_five_skills:{type:Array},
    voice:{type:String},
    isShowGender:{type:Boolean},
    isShowBirthDate:{type:Boolean},
    isShowNationality:{type:Boolean},
    isShowWorkingEnvironment:{type:Boolean},
    isShowInternetConnectionSpeed:{type:Boolean},
    isShowComputerHardwares:{type:Boolean},
    isShowheadsetQuality:{type:Boolean},
    isShowpermanentResidenceObj:{type:Boolean},
    isShowImage:{type:Boolean},
    isShowVoice:{type:Boolean},
    isShowEducationLevel:{type:Boolean},
    isShowEducationMajor:{type:Boolean},
    isShowEducationFieldOfStudy:{type:Boolean},
    isShowEducationUniInstu:{type:Boolean},
    isShowEducationGradDate:{type:Boolean},
    isShowEducationLocatedIn:{type:Boolean},
    isShowEducationTrainingSeminar:{type:Boolean},
    isShowEducationLicenseCert:{type:Boolean},
    available_full_time:{type:Boolean},
    available_part_time:{type:Boolean},
    categorization_entries:{type:Array},
    permanent_residence:{type:String},
    home_working_environment:{type:String},
    speed_test:{type:String},
    computer_hardware:{type:String},
    headsetQuality:{type:String},
    applicant_files:{type:Array},
    working_model:{type:String},
    skype_id:{type:String},
    address:{type:String},
    headset_quality:{type:String},
    internet_connection:{type:String},
    dateUpdated:{type:Date},
    dateCreated:{type:Date},
    // last_login:{type:Date},
    alt_email: {type:String},
    postcode : {type:String},
    state : {type:String},
    city : {type:String},
    pregnant : {type:String},
    pending_visa_application : {type:String},
    active_visa : {type:String},
    linked_in : {type:String},
    facebook_id : {type:String},
    icq_id : {type:String},
    handphone_no: {type:String},
    tel_no: {type:String},
    marital_status: {type:String},
    handphone_country_code :{type:String},
    tel_area_code : {type:String},
    auth_no_type_id : {type:String},
    msia_new_ic_no : {type:String},
    /**
     * operating_system
     * processor
     * ram
     * description
     * type
     * brand_name
     */
    computer_hardwares: {type:Array},
    staff_skypes: {type:Array},
    positions_desired: {type:Array},
    character_references: {type:Array},
    preferred_interview_schedules:{type:Array},
    preferred_interview_schedules_str:{type:String}

};

var jobseekerSchema  = new Schema(fields
    , {
        collection:"jobseeker"
    });



jobseekerSchema.methods.characterReferencesBatchSave = function(){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var allSaveInsertPromises = [];


    function saveData(i){
        var saveDefer = Q.defer();
        var savePromise = saveDefer.promise;

        var current_item = me.character_references[i];

        Q.delay(100).then(function(){
            characterReferencesSchema.saveSingle(current_item).then(function(result){
                me.character_references[i]["id"] = result["dataValues"]["id"];
                saveDefer.resolve(current_item);
            });

        });

        return savePromise;
    }

    for(var i = 0;i < me.character_references.length;i++){
        allSaveInsertPromises.push(saveData(i));
    }

    Q.allSettled(allSaveInsertPromises).then(function(results){
        willFulfillDeferred.resolve(me);
    });

    return willFulfill;
};




jobseekerSchema.methods.evaluationCommentsBatchSave = function(userid){
    function delay(){ return Q.delay(100); }
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var allSaveInsertPromises = [];

    if(typeof me.evaluation_comments == "undefined"){
        willFulfillDeferred.resolve(me);
    }

    function saveData(i){
        var saveInsertDeferred = Q.defer();
        var saveInsertPromise = saveInsertDeferred.promise;

        var current_item = me.evaluation_comments[i];


        me.evaluation_comments[i]["userid"] = parseInt(userid);


        if(current_item.id){

            evaluationCommentsSchema.update(current_item,{
                where:{
                    id: current_item.id
                }
            }).then(function(updatedData){
                saveInsertDeferred.resolve({success:true});
            });

        } else{
            current_item.comment_date = configs.getDateToday();

            evaluationCommentsSchema.build(current_item).save().then(function(savedItem) {
                me.evaluation_comments[i]["id"] = savedItem["dataValues"]["id"];
                saveInsertDeferred.resolve({success:true});
            }).catch(function(error) {
                saveInsertDeferred.resolve({success:true});
                console.log(error);

            });
        }

        return saveInsertPromise;
    }


    for(var i = 0;i < me.evaluation_comments.length;i++){
        allSaveInsertPromises.push(saveData(i));
        allSaveInsertPromises.push(delay);
    }

    var allPromise = Q.allSettled(allSaveInsertPromises);
    allPromise.then(function(results){



        willFulfillDeferred.resolve(me);
    });

    return willFulfill;

}


jobseekerSchema.methods.skillsBatchSave = function(userid) {
    function delay(){ return Q.delay(100); }
    var me = this;
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var allSaveInsertPromises = [];

    if(typeof me.skills == "undefined"){
        willFulfillDeferred.resolve(me);
    }

    function saveData(i){

        var saveInsertDeferred = Q.defer();
        var saveInsertPromise = saveInsertDeferred.promise;
        var current_item = me.skills[i];

        me.skills[i]["userid"] = parseInt(userid);

        try{
            if(current_item.id){

                skillsSchema.update(current_item,{
                    where:{
                        id: current_item.id
                    }
                }).then(function(updatedData){
                    //skills[i]["id"] = updatedData["id"];
                    saveInsertDeferred.resolve({success:true});
                });

            } else{
                current_item.date_time = configs.getDateToday();

                skillsSchema.build(current_item).save().then(function(savedItem) {
                    me.skills[i]["id"] = savedItem["dataValues"]["id"];
                    saveInsertDeferred.resolve({success:true, added: savedItem});
                }).catch(function(error) {
                    console.log("error saving skills!");
                    console.log(error);
                    saveInsertDeferred.resolve({success:true});

                });

            }
        } catch(errorSkill){
            console.log(errorSkill);
        }


        return saveInsertPromise;
    }

    for(var i = 0;i < me.skills.length;i++){
        //var current_item = skills[i];

        allSaveInsertPromises.push(saveData(i));
        allSaveInsertPromises.push(delay);
    }

    var allPromise = Q.allSettled(allSaveInsertPromises);
    allPromise.then(function(results){
        willFulfillDeferred.resolve(me);
    });

    return willFulfill;
}




jobseekerSchema.methods.languagesBatchSave = function(userid) {
    function delay(){ return Q.delay(100); }
    var me = this;
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var allSaveInsertPromises = [];

    if(typeof me.languages == "undefined"){
        willFulfillDeferred.resolve(me);
    }

    function saveData(i){

        var saveInsertDeferred = Q.defer();
        var saveInsertPromise = saveInsertDeferred.promise;
        var current_item = me.languages[i];

        me.languages[i]["userid"] = parseInt(userid);

        if(current_item.id){

            languagesSchema.update(current_item,{
                where:{
                    id: current_item.id
                }
            }).then(function(updatedData){
                saveInsertDeferred.resolve({success:true});
            });

        } else{
            languagesSchema.build(current_item).save().then(function(savedItem) {
                me.languages[i]["id"] = savedItem["dataValues"]["id"];
                saveInsertDeferred.resolve({success:true, added: savedItem});
            }).catch(function(error) {
                saveInsertDeferred.resolve({success:true});
                console.log("error saving languages!");
                console.log(error);

            });
        }

        return saveInsertPromise;
    }

    for(var i = 0;i < me.languages.length;i++){
        //var current_item = skills[i];

        allSaveInsertPromises.push(saveData(i));
        allSaveInsertPromises.push(delay);
    }

    var allPromise = Q.allSettled(allSaveInsertPromises);
    allPromise.then(function(results){
        willFulfillDeferred.resolve(me);
    });

    return willFulfill;
};


jobseekerSchema.methods.categoriesBatchSave = function(userid){

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var me = this;

    var all_save_promises = [];

    var data = me.categorization_entries;

    var userid = parseInt(userid);

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

    var AslCategorizationEntry = db.model("AslCategorizationEntry", aslCategorizationEntry);

    function fetchMysqlThenSyncToMongo(id){

        var saveEntryDefer = Q.defer();
        var saveEntryPromise = saveEntryDefer.promise;
        //after saving to mysql fetch data from mysql then sync to mongo
        Q.delay(100).then(function(){
            jobSubCategoryApplicantsSchema.getById(id).then(function(foundJsca){
                //save to mongo
                saveAslEntry(foundJsca["dataValues"]).then(function(result){
                    saveEntryDefer.resolve(result);
                });
            });
        });

        return saveEntryPromise;
    }


    function saveAslEntry(current_item){
        var saveEntryDefer = Q.defer();
        var saveEntryPromise = saveEntryDefer.promise;

        //var current_item = result[i]["dataValues"];

        Q.delay(100).then(function(){
            var asl_entry = new AslCategorizationEntry();
            asl_entry.saveFromMysql(current_item).then(function(saveResult){
                saveEntryDefer.resolve(true);
            });
        });


        return saveEntryPromise;
    }

    function saveEntry(i){
        var saveDefer = Q.defer();
        savePromise = saveDefer.promise;

        var current_item = data[i];
        current_item.userid = userid;


        Q.delay(50).then(function(){
            if(current_item.id){

                jobSubCategoryApplicantsSchema.update(current_item,{
                    where:{
                        id: current_item.id
                    }
                }).then(function(updatedData){
                    fetchMysqlThenSyncToMongo(current_item.id).then(function(result){
                    });
                    saveDefer.resolve({success:true});

                });

            } else{

                current_item.sub_category_applicants_date_created = new Date();
                current_item.dateCreated = new Date();

                jobSubCategoryApplicantsSchema.build(current_item).save().then(function(savedItem) {
                    me.categorization_entries[i]["id"] = savedItem["dataValues"]["id"];

                    saveDefer.resolve({success:true});

                    fetchMysqlThenSyncToMongo(savedItem["dataValues"]["id"]).then(function(result){
                    });

                }).catch(function(error) {
                    console.log(error);
                    saveDefer.resolve({success:true});

                });
            }
        });

        return savePromise;
    }

    for(var i = 0;i < data.length;i++){
        all_save_promises.push(saveEntry(i));
    }

    var allPromises = Q.allSettled(all_save_promises);
    allPromises.then(function(results){
        willFulfillDeferred.resolve(me);
    });

    return willFulfill;
};


jobseekerSchema.methods.extractComputerHardwares = function(computer_hardware_str){
    function delay(){ return Q.delay(100); }
    var me = this;


    var computer_hardware=computer_hardware_str;

    if(!computer_hardware){
        return me.computer_hardwares;
    }

    var tools = computer_hardware.split("\n");// explode("\n",computer_hardware);
    if(tools[0]){
        var desktop = tools[0].replace("desktop ","");// str_replace("desktop ","",tools[0]);
        if(desktop!=""){
            var desktop_specs = desktop.split(",");// explode(",",desktop);
            var desktop_os = desktop_specs[1];
            var desktop_processor = desktop_specs[2];
            var desktop_ram = desktop_specs[3];
        }
    }


    if(tools[1]){
        var laptop = tools[1].replace("laptop ","");// str_replace("laptop ","",tools[1]);

        if(laptop!=""){
            laptop = laptop.replace("laptop","");// str_replace("laptop ","",tools[1]);

            var laptop_specs = laptop.split(",");// explode(",",laptop);
            var laptop_os = laptop_specs[1];
            var laptop_processor = laptop_specs[2];
            var laptop_ram = laptop_specs[3];
        }
    }

    var headset = null;
    if(tools[2]){
        var headset = tools[2];
    }

    var headphone = null;
    if(tools[3]){
        var headphone = tools[3];
    }

    var printer = null;
    if(tools[4]){
        var printer = tools[4];
    }

    var scanner = null;
    if(tools[5]){
        var scanner = tools[5];
    }

    var tablet = null;
    if(tools[6]){
        var tablet = tools[6];
    }

    var pen_tablet = null;
    if(tools[7]){
        var pen_tablet = tools[7];
    }


    var found_desktop = false;
    var found_laptop = false;
    var found_headset = false;
    var found_headphone = false;
    var found_printer = false;
    var found_scanner = false;
    var found_tablet = false;
    var found_pen_tablet = false;


    for(var i = 0;i < me.computer_hardwares.length;i++){
        var current_item = me.computer_hardwares[i];

        if(current_item.type == "DESKTOP"){
            if(!found_desktop){
                found_desktop = true;
                if(desktop!=""){
                    if(current_item.operating_system){
                        me.computer_hardwares[i]["operating_system"] = desktop_os;
                    }

                    if(current_item.processor){
                        me.computer_hardwares[i]["processor"] = desktop_processor;
                    }

                    if(current_item.ram){
                        me.computer_hardwares[i]["ram"] = desktop_ram;
                    }
                }
            }
        } else if(current_item.type == "LAPTOP"){
            if(!found_laptop){
                found_laptop = true;
                if(laptop!=""){
                    if(current_item.operating_system){
                        me.computer_hardwares[i]["operating_system"] = laptop_os;
                    }

                    if(current_item.processor){
                        me.computer_hardwares[i]["processor"] = laptop_processor;
                    }

                    if(current_item.ram){
                        me.computer_hardwares[i]["ram"] = laptop_ram;
                    }
                }
            }
        } else if(current_item.type == "HEADSET"){
            if(!found_headset){
                found_headset = true;
                me.computer_hardwares[i]["brand_name"] = headset;
            }
        }
        // else if(current_item.type == "HIGH_PERFORMANCE_HEADSET"){
        //     if(!found_headphone){
        //         found_headphone = true;
        //         me.computer_hardwares[i]["brand_name"] = headphone;
        //     }
        // }
        // else if(current_item.type == "PRINTER"){
        //     if(!found_printer){
        //         found_printer = true;
        //         me.computer_hardwares[i]["brand_name"] = printer;
        //     }
        // } else if(current_item.type == "SCANNER"){
        //     if(!found_scanner){
        //         found_scanner = true;
        //         me.computer_hardwares[i]["brand_name"] = scanner;
        //     }
        // } else if(current_item.type == "TABLET"){
        //     if(!found_tablet){
        //         found_tablet = true;
        //         me.computer_hardwares[i]["brand_name"] = tablet;
        //     }
        // } else if(current_item.type == "PEN_TABLET"){
        //     if(!found_pen_tablet){
        //         found_pen_tablet = true;
        //         me.computer_hardwares[i]["brand_name"] = pen_tablet;
        //     }
        // }
    }


    if(!found_desktop && desktop!=""){
        //add desktop
        var data_to_add = {
            operating_system: desktop_os,
            processor: desktop_processor,
            ram: desktop_ram,
            type: "DESKTOP"
        };

        me.computer_hardwares.push(data_to_add);
    }

    if(!found_laptop && laptop!=""){
        //add laptop
        var data_to_add = {
            operating_system: laptop_os,
            processor: laptop_processor,
            ram: laptop_ram,
            type: "LAPTOP"
        };

        me.computer_hardwares.push(data_to_add);
    }


    if(!found_headset && headset){
        var data_to_add = {
            brand_name: headset,
            type: "HEADSET"
        };

        me.computer_hardwares.push(data_to_add);
    }


    // if(!found_headphone && headphone){
    //     var data_to_add = {
    //         brand_name: headphone,
    //         type: "HIGH_PERFORMANCE_HEADSET"
    //     };
    //
    //     me.computer_hardwares.push(data_to_add);
    // }
    //
    //
    //
    // if(!found_printer){
    //     var data_to_add = {
    //         brand_name: printer,
    //         type: "PRINTER"
    //     };
    //
    //     me.computer_hardwares.push(data_to_add);
    // }
    //
    //
    // if(!found_scanner){
    //     var data_to_add = {
    //         brand_name: scanner,
    //         type: "SCANNER"
    //     };
    //
    //     me.computer_hardwares.push(data_to_add);
    // }
    //
    //
    // if(!found_tablet){
    //     var data_to_add = {
    //         brand_name: tablet,
    //         type: "TABLET"
    //     };
    //
    //     me.computer_hardwares.push(data_to_add);
    // }
    //
    //
    // if(!found_pen_tablet){
    //     var data_to_add = {
    //         brand_name: pen_tablet,
    //         type: "PEN_TABLET"
    //     };
    //
    //     me.computer_hardwares.push(data_to_add);
    // }




    return me.computer_hardwares;


};
 
module.exports = jobseekerSchema;