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
	couch_id:{type:String},
    client_hourly_rate : String,
    prepaid : String,
    subcontractors_id : Number,
    time_in : Date,
    time_out : Date,
    userid : Number,
    leads_id : Number,
    type : String,
    client_perspective_time_in : Date,
    client_perspective_time_out : Date,
    timerecord_id : Number,
    sync_in : Date,
    sync_out : Date
};


var timeRecordsSchema = new Schema(fields,
{collection:"rssc_time_records"});


module.exports = timeRecordsSchema;