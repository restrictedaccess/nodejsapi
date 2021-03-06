var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var timesheetCommunicationRecordsSchema = new Schema({
    timesheet_id:Number,
    subcontractors_id:Number,
    date_added:Date,
    note:String,
    admin_id:Number,
    admin_name:String,
}, {
    collection:"timesheet_communication_records"
});



module.exports = timesheetCommunicationRecordsSchema;