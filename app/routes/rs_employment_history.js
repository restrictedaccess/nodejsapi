
/**
 * REQUIRES
 */
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var apiUrl = configs.getAPIURL();
var njsUrl = "http://127.0.0.1:3000";
http.post = require("http-post");
var moment = require('moment');
var moment_tz = require('moment-timezone');
var env = require("../config/env");

/**
 * IMPORT SCHEMAS
 */
var Subcontractors = require("../mysql/Subcontractors");

router.all("*", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});



router.get("/fetch", function (req, res, next) {
    if(!req.query.userid){
        return res.status(200).send({success:false, error:"userid is required!"});
    }



    Subcontractors.getRSEmploymentHistory(req.query.userid).then(function(history){
        var rs_employment_history = [];
        if(history.length > 0){
            for(var i = 0;i < history.length;i++){
                rs_employment_history.push(history[i]["dataValues"]);
            }
        }

        return res.status(200).send({success:true, result:rs_employment_history});
    });



    // staffSkypesSchema.getStaffSkypes(req.query.userid).then(function(results){
    //     for(var i = 0;i < results.length;i++){
    //         var current_item = results[i];
    //         staff_skypes_value.push({
    //             id: current_item.dataValues["id"],
    //             skype_id: current_item.dataValues["skype_id"],
    //             date_created: current_item.dataValues["date_created"],
    //             date_updated: current_item.dataValues["date_updated"],
    //         });
    //     }
    //     return res.status(200).send({success:true, result:staff_skypes_value});
    // });


});




module.exports = router;
