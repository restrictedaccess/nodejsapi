var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();


var staffHistoryMongoSchema = new Schema({
    userid:Number, //staff_history.userid
    changes:String, //staff_history.changes
    dateChange:Date, //staff_history.date_change
    changeBy:{
        id:Number,
        firstName:String,
        lastName:String
    }, //staff_history.change_by_id, if change_by_type IN ("ADMIN", "HR", "AGENT") if change_by_type == "STAFF" then changeBy is empty
}, {
    collection:"staff_history"
});

module.exports = staffHistoryMongoSchema;