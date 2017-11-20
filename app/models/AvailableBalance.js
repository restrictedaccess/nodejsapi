var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var invoiceSchema = require("../models/Invoice");


var fields = {
	client_id : {type:Number, required:true},
	fname:{type:String},
	lname:{type:String},
	email:{type:String},
	number_of_active_subcons:Number,
	currency : {type:String, required:true},
	apply_gst : String,
	currency : String,
	days_before_suspension : Number,
	currency_sign : String,
	available_balance : Number,
	daily_rate : Number,	
	credit_low : Number,	
	date_synced : Date,
	they_owe_us : Array,
	full_content : Array,

};

var availableBalanceSchema = new Schema(fields,
{collection:"client_available_balance"});


module.exports = availableBalanceSchema;