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
var moment = require('moment');
var moment_tz = require('moment-timezone');

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
    last_name:{type:String},
    latest_job_title:{type:String},
    nationality:{type:String},
    no_show_entires:{type:Array},
    recruiter:{
        first_name:{type:String},
        id:{type:Number},
        last_name:{type:String},
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
    categorization_entries:{type:Array},
    permanent_residence_obj:{
        name:{type:String},
        sortname:{type:String},
    },
    home_working_environment:{type:String},
    speed_test:{type:String},
    computer_hardware:{type:String},
    headsetQuality:{type:String},
    applicant_files:{type:Array},

    full_time_availability_timezone:{type:Array},
    part_time_availability_timezone:{type:Array},
    full_time_rates:{type:Array},
    part_time_rates:{type:Array},
    full_time_rates_id:{type:Number},
    part_time_rates_id:{type:Number},

    available_full_time:{type:Boolean},
    available_part_time:{type:Boolean},
    full_time_negotiable : {type:String},
    part_time_negotiable: {type:String},

    /**
     * operating_system
     * processor
     * ram
     * description
     * type
     * brand_name
     */
    computer_hardwares: {type:Array}
};

var aslResumeSchema  = new Schema(fields
, {
    collection:"candidates_asl"
});


module.exports = aslResumeSchema;