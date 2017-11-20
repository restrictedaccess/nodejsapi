
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
http.post = require("http-post");

var jobOrderSchema = require("../models/JobOrder");


var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});


/*
 * Method to fetch job orders by date
 * @url /job-orders/fetch-jo-by-date-ordered/
 * @param string start_date
 * @param string end_date
 * @param Array fields
 * @param boolean with_hired_dates
 *
 * start_date=2016-08-01&end_date=2016-08-31&fields[]=service_type&fields[]=date_filled_up&fields[]=client&fields[]=no_of_staff_needed&fields[]=tracking_code&fields[]=leads_id&fields[]=order_status&fields[]=age&fields[]=posting_id
 *
 */
router.get("/fetch-jo-by-date-ordered", function(req,res,next){
    if(!req.query.start_date){
        return res.status(200).send({success:false, error: "start_date is required!"});
    }

    if(!req.query.end_date){
        return res.status(200).send({success:false, error: "end_date is required!"});
    }

    if(!req.query.fields){
        return res.status(200).send({success:false, error: "fields is required!"});
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var quoteMongoSchema = require("../models/QuoteModel");
    var JobOrderModel = db.model("JobOrder", jobOrderSchema);
    var Quote = db.model("Quote", quoteMongoSchema);

    var JobOrderObj = new JobOrderModel();
    var QuoteObj = new Quote();


    var start_date = new Date(Date.parse(req.query.start_date));
    var end_date = new Date(Date.parse(req.query.end_date));

    var selectedFields = {};
    for(var i = 0;i < req.query.fields.length;i++){
        var current_item = req.query.fields[i];

        selectedFields[current_item] = 1;
    }

    if(!req.query.with_hired_dates){

        JobOrderObj.getAllByQuery(
            {
                date_filled_up:{
                    $lte: end_date,
                    $gte: start_date
                },
                deleted:{
                    $ne:true
                }
            },
            selectedFields
        ).then(function(result){

            console.log("without hired dates");
            return res.status(200).send({success:true, result: result});
        });
    } else{
        QuoteObj.getAllWithHiredDates(
            {
                $and:[
                    {
                        "quote_details.tracking_code":{
                            $exists:true
                        }
                    },
                    {
                        "quote_details.tracking_code":{
                            $ne: null
                        }
                    },
                    {
                        date_quoted:{
                            $lte: end_date,
                            $gte: start_date
                        },
                    }
                ]

            },
            selectedFields
        ).then(function(result){

            console.log("WITH hired dates");
            return res.status(200).send({success:true, result: result});
        });
    }


});



module.exports = router;