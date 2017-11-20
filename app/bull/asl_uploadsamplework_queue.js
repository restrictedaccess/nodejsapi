var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');

var Queue = require('bull');
var configs = require("../config/configs");
var asl_uploadsamplework_queue = Queue('asl_uploadsamplework_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();

var componentWebsocket = require("../components/WebsocketConnection");

asl_uploadsamplework_queue.process(function(job, done){
    var req = job.data;
    if(!req.body.candidate){
        console.log("Candidate is required!");
        done();
    }

    if(!req.body.file_type){
        console.log("file_type is required!");
        done();
    }

    if(!req.body.applicant_file_data){
        console.log("applicant_file_data is required!");
        done();
    }

    var file = req.files[0];

    if(!file){
        console.log("file image is required!");
        done();
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var gridFSSchema = require("../models/CandidatesFileUploads");
    var GridFsUpload = db.model("GridFsUpload", gridFSSchema);
    var StaffHistory = require("../mysql/StaffHistory");
    var Personal_Info = require("../mysql/Personal_Info");
    var ApplicantFile = require("../mysql/ApplicantFile");

    var candidate = JSON.parse(req.body.candidate);
    var staff_history = JSON.parse(req.body.staff_history);
    var path = configs.getTmpFolderPath();

    //html file
    var sample_work_filename = candidate.id + "_" + file.originalname;
    var tmp_file_path = path+""+sample_work_filename;

    var websocketComponentObj = new componentWebsocket();


    //save to tb_applicant_files
    var applicant_file_data = JSON.parse(req.body.applicant_file_data);
    applicant_file_data.userid = candidate.id;
    ApplicantFile.saveFile(applicant_file_data).then(function(savedFile){
        res.status(200).send(savedFile);
    });

    db.once('open', function () {
        GridFsUpload.findOne({userid:candidate.id, filename: sample_work_filename}).exec(function(err, existingRecord){

            var new_grid_fs = new GridFsUpload();
            if(existingRecord){
                console.log("record found!");
                new_grid_fs = existingRecord;
            }

            new_grid_fs.saveFile(file, sample_work_filename, tmp_file_path, candidate, req.body.file_type).then(function(gridSaveResult){
                db.close();

                console.log({
                    key: req.body.key,
                    app: req.body.app,
                    message: '{"success": true,"title": "File ' + sample_work_filename + ' Successfully Uploaded!","body": "<small>' + moment().format("YYYY-MM-DD HH:mm:ss") + '</small>","event_to_emit":"uploadedSampleWorks","toastr_type":"success"}'
                });
                try{
                    websocketComponentObj.sendWebsocketNotification({
                        key: req.body.key,
                        app: req.body.app,
                        message: '{"success": true,"title": "File ' + sample_work_filename + ' Successfully Uploaded!","body": "<small>' + moment().format("YYYY-MM-DD HH:mm:ss") + '</small>","event_to_emit":"uploadedSampleWorks","toastr_type":"success"}'
                    });

                } catch(major_error){
                    console.log(major_error);
                }

                done();
            });
        });
    });

    StaffHistory.batchSave(staff_history);
});


module.exports = asl_uploadsamplework_queue;