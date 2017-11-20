
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
var jobseekerSchema = require("../models/Jobseeker");
var recruiterStaffSchema = require("../mysql/RecruiterStaff");


var candidatesQueue = require("../bull/candidates_queue");

var multiProcessQueue = require("../bull/cluster_process");
var candidatesProcessDef = require("../bull/candidates");

var asl_candidates_queue = require("../bull/asl_candidates_queue");

var http = require("http");
http.post = require('http-post');



var sha1 = require('locutus/php/strings/sha1');

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

function supportCrossOriginScript(req, res, next) {
    res.status(200);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
}



router.get("/send-websocket",function(req,res,next){


    var componentWebsocket = require("../components/WebsocketConnection");
    var websocketComponentObj = new componentWebsocket();

    console.log(req.query);

    websocketComponentObj.sendWebsocketNotification(req.query);

    return res.status(200).send({success:true,result:"sent websocket"});
});



router.get("/receive-websocket",function(req,res,next){


    var componentWebsocket = require("../components/WebsocketConnection");
    var websocketComponentObj = new componentWebsocket();

    console.log(req.query);

    websocketComponentObj.receiveWebsocketNotification(req.query._id);

    return res.status(200).send({success:true,result:"received websocket"});
});




module.exports = router;
