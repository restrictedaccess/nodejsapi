var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
	subcon_id:{type:Number},
    userid:{type:Number},
    client_id:{type:Number},
    csro_id:{type:Number},
    client_name:{type:String},
    staff_name:{type:String},
    staffing_consultant:{type:String},
    contract_status:{type:String},   
    date_change : Date,
    date_change_unix : {type:Number},
    date_change_str : {type:String},
    remarks : {type:Number},
};


var subconSuspensionLogsSchema = new Schema(fields,
{collection:"subcon_suspension_logs"});


module.exports = subconSuspensionLogsSchema;

subconSuspensionLogsSchema.methods.getTotal = function(mailbox_doc){
	
};