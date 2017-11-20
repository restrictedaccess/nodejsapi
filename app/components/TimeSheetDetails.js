var Q = require('q');

var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var swig  = require('swig');
var TsDetails = function(){};

var env = require("../config/env");

var timesheetDetailsFileUploadSchema = require("../models/TimeSheetFileUpload");

TsDetails.prototype.prepareSend = function(params)
{

    var has_file = params.sendNotes.has_screenshot;

    var fs = require('fs');

    var nano = configs.getCouchDb();
    var mailbox = nano.use("mailbox");

    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");

    var added_on = atz.toDate();

    var template = swig.compileFile(configs.getEmailTemplatesPath() + '/timesheet_details/timesheet-details.html');

    var output = template({
        data : params
    });

    var to = [];
    var cc = [];
    var bcc = [];

    var assigned_sc = (typeof params.sc !== "undefined" ? params.sc.email : params.sc.email ? params.sc.email : null);
    var to_person = "attendance@remotestaff.com.au";


    if(env.environment == "production")
    {
        to.push(assigned_sc);
        to.push(to_person);
        cc.push(null);
        bcc.push(null);
    }
    else
    {
        to.push("devs@remotestaff.com.au");
        cc.push("devs@remotestaff.com.au");
        bcc.push("devs@remotestaff.com.au");
    }


    var mailbox_doc = {
        bcc : bcc ,
        cc : cc ,
        created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
        from : "Attendance",
        sender : "devs@remotestaff.com.au",
        reply_to : "devs@remotestaff.com.au",
        generated_by : "NODEJS/timesheet_detals/timesheet-add-notes",
        html : output,
        text : null,
        to :to,
        sent : false,
        subject : "New Timesheet Note from : "+params.ts.personal.fname+" "+params.ts.personal.lname
    };


    if(has_file)
    {
        mailbox_doc.sent = true;
        var me = this;
        this.getCouchID(mailbox_doc).then(function(couch_id){
            console.log(couch_id);
            if(couch_id)
            {
                me.attachFiles(couch_id,params.id).then(function(){
                    me.updateMailbox(couch_id).then(function(response){


                        console.log(response);

                        if(response)
                        {
                            result = {
                                success: true,
                                msg: "Email successfully sent!",
                                couch_id: couch_id
                            };

                            cosnole.log(result);

                        }
                        else
                        {
                            result = {
                                success: false,
                                msg: "Email sending failed!"
                            };
                            cosnole.log(result);
                        }
                    });
                });
            }

        }).catch(function(err){
            console.log(err);
        });

    }
    else
    {
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

}

TsDetails.prototype.getCouchID = function(doc)
{
    var fs = require('fs');
    var nano = configs.getCouchDb();
    var db_name = "";

    db_name = "mailbox";

    var db = nano.use(db_name);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    db.insert(doc, function(err, body){
        if (err) {
            console.error(err);
            willFulfillDeferred.reject(err);
        }
        console.log(db_name);

        var couch_id = body.id;
        willFulfillDeferred.resolve(couch_id);

    });
    return willFulfill;
}

TsDetails.prototype.attachFiles = function(couch_id,id)
{
    var fs = require('fs');
    var nano = configs.getCouchDb();
    var db_name = "mailbox";
    var db = nano.use(db_name);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;

    var db_mongo = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
    var Ts_GridFsUpload = db_mongo.model("Ts_GridFsUpload", timesheetDetailsFileUploadSchema);

    var ts_notes_id = id;
    console.log(ts_notes_id);
    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;

    db_mongo.once('open', function () {
        gfs = Grid(db_mongo.db);
        Ts_GridFsUpload.findOne({timesheet_notes_id:parseInt(ts_notes_id)}).exec(function(err, existingRecord){
            if(existingRecord){
                console.log("record");
                console.log(existingRecord);


                gfs.findOne({_id: existingRecord.gridfs_id}, function (err, file) {
                    console.log(file);

                    if (err) {
                        db_mongo.close();
                        willFulfillDeferred.resolve({success:false});
                    }
                    else if (!file) {
                        db_mongo.close();
                        willFulfillDeferred.resolve({success:false});
                    }


                    // res.set('Content-Type', file.contentType);
                    //res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

                    var readstream = gfs.createReadStream({
                        _id: existingRecord.gridfs_id,
                        filename: file.filename
                    });
                    //

                    var buffer = [];
                    readstream.on("data", function (chunk) {
                        buffer.push(chunk);
                    });

                    readstream.on("end", function () {

                        var fbuf = Buffer.concat(buffer);
                        //
                        // var File = (fbuf.toString('base64'));

                        db.get(couch_id, function(err, mailbox_doc) {
                            if (err) {
                                console.error(err);
                                willFulfillDeferred.reject(err);
                                return;
                            }

                            updaterev = mailbox_doc._rev;
                            mailbox_doc._rev = updaterev;

                            mailbox_doc.sent = true;
                            db.attachment.insert( couch_id, file.filename, new Buffer(fbuf, "binary"), 'application/octet-stream', {rev: mailbox_doc._rev}, function(err, body) {
                                if (err) {
                                    willFulfillDeferred.reject(err);
                                    return;
                                }
                                willFulfillDeferred.resolve(body.rev);
                                console.log("File attached.");
                                db_mongo.close();
                            });

                        });

                    });

                    readstream.on("error", function (err) {
                        console.log(err);
                        res.end();
                        db.close();
                        db_mongo.close();
                    });

                });
            } else{
                willFulfillDeferred.resolve({success:false});
                db_mongo.close();
            }

        });
    });

    return willFulfill;
}

TsDetails.prototype.updateMailbox = function(couch_id)
{

    console.log("update");
    console.log(couch_id);
    var nano = configs.getCouchDb();
    var db_name = "mailbox";
    var db = nano.use(db_name);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;

    db.get(couch_id, function(err, mailbox_doc) {
        if (err) {
            console.error(err);
            willFulfillDeferred.reject(err);
        }

        mailbox_doc.sent = false;

        console.log(mailbox_doc);
        db.insert( mailbox_doc, couch_id, function(err, body) {
            if (err){
                willFulfillDeferred.reject(err);
            }
            console.log("Mailbox document updated");
            willFulfillDeferred.resolve(body);
        });

    });

    return willFulfill;
}



module.exports = new TsDetails();