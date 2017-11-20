var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
	couch_id:{type:String},
	credit:Number,
	currency : {type:String, required:true},
	credit_type : String,
	charge : Number,
	running_balance : Number,
	added_on : Date,
	client_id : {type:Number, required:true},
	particular : String,
	remarks : String,
	type : {type:String, required:true},
	added_by : String
};

var runningBalanceSchema = new Schema(fields,
{collection:"client_running_balance"});





module.exports = runningBalanceSchema;