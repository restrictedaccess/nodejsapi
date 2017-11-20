var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');

var Queue = require('bull');
var configs = require("../config/configs");
var asl_fileuploads_queue = Queue('asl_fileuploads_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();
var componentWebsocket = require("../components/WebsocketConnection");

asl_fileuploads_queue.process(function(job, done){
    var req = job.data;
    console.log(req);
    try {
        if(!req.body.candidate){
            done();
        }


        var websocketComponentObj = new componentWebsocket();


        var candidate = JSON.parse(req.body.candidate);

        var file = req.files[0];

        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

        var gridFSSchema = require("../models/CandidatesFileUploads");
        var GridFsUpload = db.model("GridFsUpload", gridFSSchema);

        var path = configs.getTmpFolderPath();

        var extension = file.originalname.split(".");

        //html file
        var voice_filename = candidate.id + "." + extension[1];
        var tmp_file_path = path+""+voice_filename;

        db.once('open', function () {
            GridFsUpload.findOne({userid:candidate.id, file_type: "IMAGE"}).exec(function(err, existingRecord){

                var new_grid_fs = new GridFsUpload();
                if(existingRecord){
                    console.log("record found!");
                    new_grid_fs = existingRecord;
                }

                new_grid_fs.saveFile(file, voice_filename, tmp_file_path, candidate, "IMAGE").then(function(gridSaveResult){
                    db.close();

                    console.log("lkasjdlfkjasdklfjasd");
                    console.log("lkasjdlfkjasdklfjasd");
                    console.log("lkasjdlfkjasdklfjasd");
                    console.log("lkasjdlfkjasdklfjasd");
                    console.log("lkasjdlfkjasdklfjasd");
                    console.log("lkasjdlfkjasdklfjasd");

                    websocketComponentObj.sendWebsocketNotification({
                        key: req.body.key,
                        app: req.body.app,
                        message: '{"success": true,"title": "Profile Picture Successfully Uploaded!","body": "<small>' + moment().format("YYYY-MM-DD HH:mm:ss") + '</small>","event_to_emit":"uploadedProfileImage","toastr_type":"success"}'
                    });

                    done();

                });
            });
        });
    }catch(major_error){
        console.log(major_error);
    }
});


module.exports = asl_fileuploads_queue;