var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var moment = require('moment');
var moment_tz = require('moment-timezone');


var fields = {
    mongo_status: {type:String},
    couch_status: {type:String},
    couch_id: {type:String},
    order_id: {type:String},
    date_reported: {type:Date}
};

var invoiceStatusDifferenceReportingSchema = new Schema(fields,
    {collection:"invoice_status_difference_reporting"});

module.exports = invoiceStatusDifferenceReportingSchema;


