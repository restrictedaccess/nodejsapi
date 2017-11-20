var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");


var moment = require('moment');
var moment_tz = require('moment-timezone');
var Queue = require('bull');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();


var timeSheetSchema = require("../mysql/Timesheet");
var timeSheetNotesSubcon = require("../mysql/TimeSheetNotesSubcon");
var timesheetDetailsSchema = require("../mysql/TimeSheetDetails");

var ts_detailsQueue = Queue("timesheet_details", 6379, '127.0.0.1');


ts_detailsQueue.process(function(job,done){

    var ts_details_id = (typeof job.data.ts_details_id !== "undefined" ? job.data.ts_details_id  : null);
    // var working_hrs = (typeof job.data.work_hours !== "undefined" ? job.data.work_hours : 0.0);
    // var notes_category = (typeof job.data.notes_category !== "undefined" ? job.data.notes_category : "");
    var ts_notes_id = (typeof job.data.ts_notes_id !== "undefined" ? job.data.ts_notes_id : "");
    // var file_name = (typeof job.data.file_name !== "undefined" ? job.data.file_name : "");
    //
    var save_to_mongo_params = {
        ts_notes_id : ts_notes_id
    }


    console.log("starting bull process "+ts_details_id);
    var promise = [];


    function delay() {
        return Q.delay(100);
    }


    timesheetDetailsSchema.getDetails(ts_details_id).then(function(ts_details){

        var promise_ts = [];
        ts_details.ts_schema = timeSheetSchema;
        ts_details.ts_notes_schema = timeSheetNotesSubcon;
        var ts = ts_details.getTS();
        var notes = ts_details.getNotesSubcon();

        promise_ts.push(ts);
        promise_ts.push(delay);

        promise_ts.push(notes);
        promise_ts.push(delay)

        ts_promise = Q.allSettled(promise_ts);
        promise.push(ts_promise);
        promise.push(delay);

        var allPromise = Q.all(promise);
        allPromise.then(function (results) {
            console.log("Done Promise!");
            ts_details.saveToMongo(save_to_mongo_params);
            console.log("Synced!");
            done();
        });
    });
});

module.exports = ts_detailsQueue;