var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var http = require("http");
var swig  = require('swig');

var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});




/*
 * Save staff_history
 * @url http://test.njs.remotestaff.com.au/invoice/search
 * @param int id
 */

router.post("/save", function(req,res,next){

    var staffHistorySchema = require("../mysql/StaffHistory");

    if(!req.body.candidate){
        return res.status(200).send({success:false, error: "candidate is required"});
    }

    if(!req.body.staff_history){
        return res.status(200).send({success:false, error: "staff_history is required"});
    }

    var staff_history = req.body.staff_history;

    staff_history.date_change = new Date();
    staff_history.userid = parseInt(req.body.candidate.id);

    staffHistorySchema.build(staff_history).save().then(function (savedHistory) {
        console.log("History saved!" + savedHistory.id);
        return res.status(200).send({success:true, result: savedHistory});
    }).catch(function (error) {
        console.log("History saving failed!");
        console.log(error);
        return res.status(200).send({success:false, error: error});
    });

});



module.exports = router;

