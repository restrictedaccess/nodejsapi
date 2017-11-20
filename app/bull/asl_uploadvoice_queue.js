var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');

var Queue = require('bull');
var configs = require("../config/configs");
var asl_uploadvoice_queue = Queue('asl_uploadvoice_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();

var componentWebsocket = require("../components/WebsocketConnection");

asl_uploadvoice_queue.process(function(job, done){
    var req = job.data;
    console.log('testing bull upload voice');
    if(!req.body.candidate){
        console.log("candidate is required!");
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

    var candidate = JSON.parse(req.body.candidate);
    var staff_history = JSON.parse(req.body.staff_history);
    console.log(candidate);
    var path = configs.getTmpFolderPath();

    var extension = file.originalname.split(".");
    var websocketComponentObj = new componentWebsocket();


    //html file
    var voice_filename = candidate.id + "." + extension[1];
    var tmp_file_path = path+""+voice_filename;

    db.once('open', function () {
        GridFsUpload.findOne({userid:candidate.id, file_type: "AUDIO"}).exec(function(err, existingRecord){

            var new_grid_fs = new GridFsUpload();
            if(existingRecord){
                console.log("record found!");
                new_grid_fs = existingRecord;
            }

            new_grid_fs.saveFile(file, voice_filename, tmp_file_path, candidate, "AUDIO").then(function(gridSaveResult){
                db.close();

                websocketComponentObj.sendWebsocketNotification({
                    key: req.body.key,
                    app: req.body.app,
                    message: '{"success": true,"title": "Voice Successfully Uploaded!","body": "<small>' + moment().format("YYYY-MM-DD HH:mm:ss") + '</small>","event_to_emit":"uploadedProfileVoice","toastr_type":"success"}'
                });

                done();
            });
        });
    });

    StaffHistory.batchSave(staff_history);
});


module.exports = asl_uploadvoice_queue;