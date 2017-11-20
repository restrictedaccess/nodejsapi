var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var lockTimesheetSchema  = new Schema({
	date_range: Array,
	date_created: Date,
	admin_id: Number,
	build : String,
	status : String
}, {
	collection:"lock_unlock_timesheets_build"
});




module.exports = lockTimesheetSchema;