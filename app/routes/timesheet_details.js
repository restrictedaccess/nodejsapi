var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var env = require("../config/env");
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

//mongo collection
var timesheetdetailsSchema = require("../models/TimeSheetDetails");

var timesheetDetailsFileUploadSchema = require("../models/TimeSheetFileUpload");

//component
var ts_detailsComponent = require("../components/TimeSheetDetails");


//bull process
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


router.post("/timesheet-add-notes",type,function(req,res,next){


    if(typeof req.body.method !== "undefined" && req.body.method == "add_note")
    {
        var params = (typeof req.body.params !== "undefined" ? JSON.parse(req.body.params) : req.body);
        var ts_details_id = (params.timesheet_details_id ? params.timesheet_details_id : null);
        var notes = (params.note_str ? params.note_str : null);
        var userid = (params.userid ? params.userid : null);
        var working_hrs = (params.work_hours ? parseFloat(params.work_hours) : 0.0 );
        var notes_category = (params.add_notes_category ? params.add_notes_category : "");
        var path = configs.getTmpFolderPath();
        var has_screenshot = false;
        var file_name = "";


        if(req.files && req.files.length > 0)
        {
            var file = (req.files[0] ? req.files[0] : null);
            has_screenshot = true;
            file_name = file.originalname;
        }



        if(!ts_details_id || !notes )
        {
            return res.status(200).send({success:false,msg:"No parameters"});
        }

        var insertData = {
            timesheet_details_id : ts_details_id,
            userid:userid,
            timestamp:configs.getDateToday(),
            note:notes,
            has_screenshot:has_screenshot,
            file_name : file_name,
            working_hrs : working_hrs,
            notes_category : notes_category
        }



        //insert notes to timesheet_notes_subcon
        var result = {};
        try {
            timesheetsubconSchema.addNotes(insertData).then(function(returnData){


                if(returnData)
                {

                    result.success = true;
                    result.data = returnData;

                    var queueParams = {
                        ts_details_id : returnData.timesheet_details_id,
                        work_hours : working_hrs,
                        notes_category : notes_category,
                        ts_notes_id : returnData.id
                    }

                    if(file)
                    {
                        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
                        var Ts_GridFsUpload = db.model("Ts_GridFsUpload", timesheetDetailsFileUploadSchema);

                        var file_attachment =  returnData.id + "_" + file.originalname;
                        var tmp_file_path = path+""+file_attachment;

                        db.once('open', function () {
                            try {

                                Ts_GridFsUpload.findOne({timesheet_notes_id:returnData.id, filename: file_attachment}).exec(function(err, existingRecord){

                                    var new_grid_fs = new Ts_GridFsUpload();
                                    if(existingRecord){
                                        console.log("record found!");
                                        new_grid_fs = existingRecord;
                                    }

                                    new_grid_fs.saveFile(file, file_attachment, tmp_file_path, returnData).then(function(gridSaveResult){
                                        db.close();
                                        queueParams.file_name = file.originalname;
                                        ts_detailsQueue.add(queueParams);
                                        // ts_detailsComponent.prepareSend({id:returnData.id,files:true});//component for sending of email
                                    });
                                });

                            }catch(e)
                            {
                                console.log(e);
                                db.close()
                            }
                        });

                    }
                    else
                    {
                        ts_detailsQueue.add(queueParams);
                        // ts_detailsComponent.prepareSend({id:returnData.id,files:false});
                    }
                }
                else
                {
                    result.success = true;
                    result.data = null;
                }


                return res.status(200).send(result);

            });


        }catch(e)
        {

            result.success = false;
            result.data = null;
            console.log(e);

            return res.status(200).send(result);
        }

    }else
    {
        return res.status(200).send({success:false,data:"Cannot identify action"});
    }

});

router.get("/test",type,function(req,res,next){

    var ts_notes_id = (req.query.ts_notes_id ? req.query.ts_notes_id : null );

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
    var Ts_GridFsUpload = db.model("Ts_GridFsUpload", timesheetDetailsFileUploadSchema);

    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;

    db.once('open', function() {
        gfs = Grid(db.db);


    });
    db.once('open', function () {
        gfs = Grid(db.db);
        Ts_GridFsUpload.findOne({timesheet_notes_id:parseInt(ts_notes_id)}).exec(function(err, existingRecord){
            if(existingRecord){
                console.log("record");
                console.log(existingRecord);


                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db.close();
                        return res.status(400).send(err);
                    }
                    else if (!file) {
                        db.close();
                        return res.status(404).send('Error on the database looking for the file.');
                    }


                    res.set('Content-Type', file.contentType);
                    //res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //

                    var buffer = "";
                    readstream.on("data", function (chunk) {
                        buffer += chunk;
                    });

                    readstream.on("end", function () {
                        console.log("contents of file:\n\n", buffer);
                    });

                    readstream.on("error", function (err) {

                        console.log(err);
                        res.end();
                        db.close();
                    });
                    readstream.pipe(res);

                });
            } else{
                return res.status(200).send({success: false, error: "No image found!"});
            }

        });
    });
})


router.get("/fetch-screenshot-ts",function(req,res,next){

    var ts_notes_id = (req.query.ts_notes_id ? req.query.ts_notes_id : null );

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
    var Ts_GridFsUpload = db.model("Ts_GridFsUpload", timesheetDetailsFileUploadSchema);

    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;

    db.once('open', function() {
        gfs = Grid(db.db);


    });
    db.once('open', function () {
        gfs = Grid(db.db);
        Ts_GridFsUpload.findOne({timesheet_notes_id:parseInt(ts_notes_id)}).exec(function(err, existingRecord){
            if(existingRecord){
                console.log("record");
                console.log(existingRecord);


                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db.close();
                        return res.status(400).send(err);
                    }
                    else if (!file) {
                        db.close();
                        return res.status(404).send('Error on the database looking for the file.');
                    }


                    res.set('Content-Type', file.contentType);
                    //res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //

                    readstream.on("error", function (err) {

                        console.log(err);
                        res.end();
                        db.close();
                    });
                    readstream.pipe(res);

                });
            } else{
                return res.status(200).send({success: false, error: "No image found!"});
            }

        });
    });

});


router.get("/ts-notes",function(req,res,next){

    var params = (typeof req.query.params !== "undefined" ? JSON.parse(req.query.params) : req.query);
    var ts_details_id = (params.timesheet_details_id ? params.timesheet_details_id : null);

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet", mongoCredentials.options);
    var TimeSheetDetailsSchema = db.model("TimeSheetDetailsSchema", timesheetdetailsSchema);

    var filter = {id:parseInt(ts_details_id)};

    db.once("open",function(){

        try {

            TimeSheetDetailsSchema.findOne(filter).exec(function(err, data){


                if(err)
                {
                    db.close();
                    return res.status(200).send({success:false,data:null});
                }
                result = {
                    success:true,
                    data:data
                }

                db.close();
                return res.status(200).send(result);


            });

        }
        catch(e)
        {
            console.log(e);
            db.close();
        }
    });

});



router.get("/sync-all-timesheet-communication-to-subcon-communication-mongo",function(req,res,next){
    var subconCommunicationRecordsSchema = require("../models/SubconCommunicationRecords");
    var timesheetCommunicationRecordsSchema = require("../models/TimesheetCommunicationRecords");
    var timesheetMysqlSchema = require("../mysql/Timesheet");


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet", mongoCredentials.options);
    var SubconCommunicationRecords = db.model("SubconCommunicationRecords", subconCommunicationRecordsSchema);
    var TimesheetCommunicationRecords = db.model("TimesheetCommunicationRecords", timesheetCommunicationRecordsSchema);

    db.once("open",function(){
        var newSubconCommunicationRecords = new SubconCommunicationRecords();


        TimesheetCommunicationRecords.find().select({_id:0}).lean().exec(function (err, fetched_timesheet_comm_records) {
            if(err){
                db.close();
                console.log(err);
                return res.status(200).send({success:false,error:err});
            }

            console.log(fetched_timesheet_comm_records);

            var all_saving_promises = [];

            function updateMongoDoc(search_key, data, callback){
                SubconCommunicationRecords.update(search_key, {$set: data}, {upsert: true}, callback);
            }

            for(var i = 0;i < fetched_timesheet_comm_records.length;i++){

                function saveToSubconCommuncationRecord(i){

                    var willFulfillDeferred = Q.defer();
                    var willFulfill = willFulfillDeferred.promise;

                    var current_record = fetched_timesheet_comm_records[i];

                    Q.delay(100).then(function(){
                        timesheetMysqlSchema.findOne({
                            attributes:["subcontractors_id"],
                            where:{
                                id:current_record["timesheet_id"]
                            }
                        }).then(function(foundObject){
                            if(foundObject){
                                current_record["subcontractors_id"] = parseInt(foundObject["subcontractors_id"]);
                            }

                            updateMongoDoc({subcontractors_id: current_record["subcontractors_id"]}, current_record, function(saveResult){
                                console.log("Added to subcon_communcation_records " + current_record["timesheet_id"])
                                willFulfillDeferred.resolve(foundObject);
                            });
                        });
                    });


                    return willFulfill;
                }

                all_saving_promises.push(saveToSubconCommuncationRecord(i));

            }

            Q.allSettled(all_saving_promises).then(function(results){

                return res.status(200).send({success:true,result:fetched_timesheet_comm_records});
            });
        });
    });

});



router.get("/email-compliance-subcon-with-notes",function(req,res,next){

    var swig  = require('swig');


    var ten_days_ago = moment_tz().subtract(10,'d');
    var four_days_ago = moment_tz().subtract(4,'d');

    if(req.query.start_date){
        ten_days_ago = moment_tz(req.query.start_date + "T00:00:00Z");
    }

    if(req.query.end_date){
        four_days_ago = moment_tz(req.query.end_date + "T00:00:00Z");
    }




    var formatted_ten_days_ago = ten_days_ago.format("YYYY-MM-DD");
    var formatted_four_days_ago = four_days_ago.format("YYYY-MM-DD");

    var formatted_start_date_display = ten_days_ago.format("MMMM D, YYYY");
    var formatted_end_date_display = four_days_ago.format("MMMM D, YYYY");

    timesheetdetailsSchemaMysql.lockTimesheetNotes(formatted_ten_days_ago, formatted_four_days_ago).then(function(updated){
        console.log(updated);
    });


    timesheetSchema.getTimeSheetsWithNotes(formatted_ten_days_ago, formatted_four_days_ago).then(function(timesheetsWithNotes){
    // timesheetSchema.getTimeSheetsWithNotes("2017-01-25", "2017-02-01").then(function(timesheetsWithNotes){

        if(timesheetsWithNotes.length > 0 && typeof req.query.send_email == "undefined"){

            var nano = configs.getCouchDb();
            var mailbox = nano.use("mailbox");

            var today = moment_tz().tz("GMT");
            var atz = today.clone().tz("Asia/Manila");

            var added_on = atz.toDate();


            var template = swig.compileFile(configs.getEmailTemplatesPath() + '/timesheet_details/timesheet-details-with-notes.html');

            var output = template({
                data : timesheetsWithNotes,
                start_date: formatted_start_date_display,
                end_date: formatted_end_date_display
            });

            var to = [];

            if(env.environment == "production"){
                to.push("attendance@remotestaff.com.au");
            } else{
                to.push("devs@remotestaff.com.au");
            }


            var mailbox_doc = {
                bcc : [null] ,
                cc : [ null ],
                created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
                from : "noreply@remotestaff.com.au",
                sender : "devs@remotestaff.com.au",
                reply_to : null,
                generated_by : "NODEJS/timesheet_detals/email-compliance-subcon-with-notes",
                html : output,
                text : null,
                to :to,
                sent : false,
                subject : "Staff’s Timesheet with Adjustments (" + formatted_start_date_display + " – " + formatted_end_date_display + ")"
            };

            mailbox.insert(mailbox_doc, function(err, body){
                if (err){
                    console.log(err.error);
                    var result = {success:false, error : err.error};
                    cosnole.log(result.error);
                }
                else {


                    var result = {
                        success:true,
                        msg : "Email successfully sent!",
                    };

                    console.log(result.msg);
                }
            });
        }
        return res.status(200).send({success:true,data:timesheetsWithNotes});
    });
});
module.exports = router;