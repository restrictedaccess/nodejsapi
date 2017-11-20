var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');


//mysql schema
var timesheetSchema = require("../mysql/Timesheet");
var timesheetdetailsSchemaMysql = require("../mysql/TimeSheetDetails");
var timesheetsubconSchema = require("../mysql/TimeSheetNotesSubcon");
var timesheetadminSchema = require("../mysql/TimeSheetNotesAdmin");
var complianceScShchema = require("../mysql/ComplianceSc");
var subcontructorsReporting = require("../models/Subcontractor");


//mongo collection
var timesheetdetailsSchema = require("../models/TimeSheetDetails");

//bull procee
var ts_detailsQueue = require("../bull/time_sheet_details");

var http = require("http");
http.post = require('http-post');



//handling file
var multer  = require('multer');
var upload = multer({ dest: '../uploads/'});
var type = upload.any();


router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

router.get("/timesheet-get-clients", function (req, res, next) {
    var params = req.query;
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var SubcontructorsReporting = db.model("Subcontractors", subcontructorsReporting);

    var search_key = {subcontractors_id: parseInt(params.sc_id)};

    db.once('open', function () {
        console.log(search_key);

        try{
            SubcontructorsReporting.findOne(search_key).exec(function(err, data){

               if(err)
               {
                   db.close();
                   return res.status(200).send({success: false});
               }
                db.close();
                return res.status(200).send({success: true, result: data});
            });
        }catch(e)
        {
            console.log(e);
        }
    });

});

router.post("/timesheet-update-status", function (req, res, next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/timesheet");
    var TimesheetdetailsSchema = db.model("TimesheetdetailsSchema", timesheetdetailsSchema);

    var params = req.body;

    console.log("timesheet-update-status");

    if(params){

        db.once('open', function () {

            var limit = params.length;

            function checkDone(i){

                if(i < limit)
                {
                    val = params[i];
                    var id = val.id;
                    var status = val.status;
                    var filter = {id: id};
                    var temp = {status: status};
                    console.log("Updating timesheet details status "+filter.id);

                    timesheetdetailsSchemaMysql.updateTimesheetDetailsStatus(filter, temp);
                    checkDone(i+1);

                }
                else {
                    db.close();
                    console.log('done');
                    return res.status(200).send({success: true, result: "Done"});
                }
            }

            checkDone(0);
        });
    }

});

router.get("/get-sc-default", function(req, res, next){
  if(!req.query.admin_id){
      return res.status(200).send({success:false, error:"parameters is required!"});
  }
  var admin_id = req.query.admin_id;

  complianceScShchema.getAdminInfo(admin_id).then(function(sc_record){
    return res.status(200).send({success: true, result: sc_record});
  });
});

router.post("/timesheet-fetch-all-mod", function (req, res, next) {

    if(!req.body){
        return res.status(200).send({success:false, error:"parameters is required!"});
    }

    console.log("timesheet-fetch-all-mod");
    console.log(req.body);
    var page = req.body.page;
    var count = req.body.count;
    var search = req.body.search;


    if(!req.body.page){
        return res.status(200).send({success: false, result: {msg: "Page is required"}});
    }

    if(!req.body.search){ // On-load
        if(count){
            timesheetSchema.getTimesheetDetailsByDetailsPage(page, null).then(function (timesheetData) {
                timesheetSchema.getTimesheetDetailsByDetailsPageCount().then(function (timesheetDataCount) {
                    return res.status(200).send({success: true, result: timesheetData, totalRecord: timesheetDataCount});
                });
            });
        } else {
            timesheetSchema.getTimesheetDetailsByDetailsPage(page, null).then(function (timesheetData) {
                return res.status(200).send({success: true, result: timesheetData});
            });
        }
    } else {
        // Search
        console.log("SEARCH SERCH SEARCH");
        var filter = {};
        var params = req.body;
        var from = params.date_range.startDate;
        var to = params.date_range.endDate;
        var is_exclude_inactive = params.is_exclude_inactive;
        var isoFrom = new Date(from).toISOString();
        var isoTo = new Date(to).toISOString();

        if(params.sc){
            var sc_arr = params.sc;
            var sc_id_arr = [];
            sc_arr.forEach(function(val, key) {
                console.log("Showing SC");
                console.log(val.admin_id);
                sc_id_arr.push(val.admin_id)
            });
            filter["sc_id"] = sc_id_arr;
            console.log("SC Not Null");
            console.log(filter);
        }

        if(params.client){
            filter["leads_id"] = parseInt(params.client.leads_id);
            console.log("Leads Not Null");
            console.log(filter);
        }

        if(params.subcon){
            filter["subcon_id"] = parseInt(params.subcon.id);
            console.log("Subcon Not Null");
            console.log(filter);
        }

        if(is_exclude_inactive){
            filter["is_exclude_inactive"] =  true;
        }

        filter["reference_date"] = {
            $gte: isoFrom,
            $lt: isoTo
        };

        timesheetSchema.getTimesheetDetailsByDetailsPage(page, filter).then(function (timesheetData) {
                timesheetSchema.getTimesheetDetailsByDetailsPageCountSeacrh(page, filter).then(function (timesheetDataCount) {
                return res.status(200).send({success: true, result: timesheetData, totalRecord: timesheetDataCount});
            });
        });
    }
});


router.get("/timesheet-fetch-all", function (req, res, next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/timesheet");
    var TimesheetdetailsSchema = db.model("TimesheetdetailsSchema", timesheetdetailsSchema);
    var filter = {};

    db.once('open', function () {
        TimesheetdetailsSchema.find(filter).exec(function (err, timesheetData) {
            if(err){
                db.close();
                console.log(error);
            }
            if(timesheetData){
                console.log("Fetched timesheetData All");
                //console.log(timesheetData);
                db.close();
                return res.status(200).send({success: true, result: timesheetData});
            }
        });
    });
});

router.post("/timesheet-fetch-notes", function (req, res, next) {

    if(!req.body){
        return res.status(200).send({success:false, error:"parameters is required!"});
    }

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/timesheet");
    var TimesheetdetailsSchema = db.model("TimesheetdetailsSchema", timesheetdetailsSchema);
    var params = req.body;

    console.log("timesheet-fetch-notes");

    var from = params.date_range.startDate;
    var to = params.date_range.endDate;
    var is_exclude_inactive = params.is_exclude_inactive;

    var isoFrom = new Date(from).toISOString();
    var isoTo = new Date(to).toISOString();
    var filter = {};

    if(params.sc){
        filter["assigned_sc.admin_id"] = parseInt(params.sc.admin_id);
        console.log("SC Not Null");
        console.log(filter);
    }

    if(params.client){
        filter["leads_info.id"] = parseInt(params.client.leads_id);
        console.log("Leads Not Null");
        console.log(filter);
    }

    if(params.subcon){
        filter["subcon_id"] = parseInt(params.subcon.id);
        console.log("Subcon Not Null");
        console.log(filter);
    }

    if(is_exclude_inactive){
        filter["leads_info.status"] =  { $nin: ["REMOVED","Inactive"]};
    }

    filter["date_created"] = {
        $gte: isoFrom,
        $lt: isoTo
    };

    console.log("Filter..");
    console.log(filter);

    db.once('open', function () {
        TimesheetdetailsSchema.find(filter).exec(function (err, timesheetData) {
            if(err){
                db.close();
                console.log(error);
            }
            if(timesheetData){
                console.log("Fetched timesheetData");
                console.log(timesheetData);
                db.close();
                return res.status(200).send({success: true, result: timesheetData});
            }
        });
    });

});

module.exports = router;
