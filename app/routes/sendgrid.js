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
http.post = require("http-post");
var moment = require('moment');

var mongoCredentials = configs.getMongoCredentials();



var personalInfoSchema = require("../mysql/Personal_Info");
var leadInfoSchema = require("../mysql/Lead_Info");
var subconSchema = require("../mysql/Subcontractors");
var clientInfoSchema = require("../models/Client");
var suppressionReportingSchema = require("../models/SuppressionReporting");


router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});




/*
 * Method in getting list of bounces, blocks, invalids and spam email and saving to mongo
 * @url http://test.njs.remotestaff.com.au/sendgrid/sync-email-supression-report/
 */
router.get("/sync-email-supression-report", function(req,res,next){
    var sendGridApiKey = configs.getSendGridAPIKey();
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice");
    var Suppression = db.model("Suppression", suppressionReportingSchema);

    function delay(){ return Q.delay(100); }

    var sg = require('sendgrid')(sendGridApiKey);

    var date_today = new Date();

    var moment_start = moment().subtract(30, "minutes");
    var moment_end = moment();

    var start_date = moment(moment_start).format("X");
    var end_date = moment(moment_end).format("X");


    if(req.query.start_date){
        start_date = moment(req.query.start_date).format("X");
    }
    console.log(start_date);


    //var start_date = Date.parse("2016-11-20 00:00:00") / 1000;



    var limit = 500;

    var allFetchPromised = [];

    var promises = [];

    var bouncesDeferred = Q.defer();
    var bouncesPromise = bouncesDeferred.promise;
    allFetchPromised.push(bouncesPromise);


    var blocksDeferred = Q.defer();
    var blocksPromise = blocksDeferred.promise;
    allFetchPromised.push(blocksPromise);


    var spamDeferred = Q.defer();
    var spamPromise = spamDeferred.promise;
    allFetchPromised.push(spamPromise);


    var invalidDeferred = Q.defer();
    var invalidPromise = invalidDeferred.promise;
    allFetchPromised.push(invalidPromise);


    var all_fetched_emails_from_sg = [];

    var total_to_fetch = 0;


    var allFetchSuppressionReportingPromises = [];


    var allFetchSuppressionReportingDeferred = Q.defer();
    var allFetchSuppressionReportingPromise = allFetchSuppressionReportingDeferred.promise;

    var urls = [
        {url: "bounces", deferr: bouncesDeferred},
        {url: "blocks", deferr: blocksDeferred},
        {url: "spam_reports", deferr: spamDeferred},
        {url: "invalid_emails", deferr: invalidDeferred}
    ];

    var url_index = 0;

    var added_emails = [];


    // Retrieve all blocks
    // GET /suppression/blocks

    db.once('open', function() {

        function getSuppression(page, url, deferredPromise){

            var offset = (page-1) * limit;


            var request = sg.emptyRequest();
            request.queryParams["start_time"] = start_date;
            request.queryParams["limit"] = limit;
            request.queryParams["end_time"] = end_date;
            request.queryParams["offset"] = offset;

            request.method = 'GET';
            request.path = '/v3/suppression/' + url;
            sg.API(request, function (error, response) {
                if(error){
                    console.log(error.response.body);
                    console.log(url);
                }


                if(response.body.length > 0){
                    total_to_fetch += response.body.length;
                    //continue


                    for(var i = 0;i < response.body.length;i++){
                        var data = response.body[i];
                        data.created = new Date(data.created * 1000);

                        data.suppression_type = url;

                        if(added_emails.indexOf(data.email) === - 1){

                            all_fetched_emails_from_sg.push(data);
                            added_emails.push(data.email);
                        }


                    }

                    getSuppression(++page, url, deferredPromise);

                } else{
                    ++url_index;

                    if(url_index < urls.length){
                        getSuppression(1, urls[url_index]["url"], urls[url_index]["deferr"]);
                    }

                    deferredPromise.resolve({success:true});
                }

            });

        }

        getSuppression(1, urls[url_index]["url"], urls[url_index]["deferr"]);

    });



    var allFetchPromise = Q.allSettled(allFetchPromised);
    allFetchPromise.then(function(results){
        console.log("All promises done!");
        function fetchEmailData(current_data){

            var current_suppression = new Suppression();
            current_suppression.db = db;

            return current_suppression.fetchSuppressionDetails(current_data);
        }

        for(var i = 0;i < all_fetched_emails_from_sg.length;i++){
            var data = all_fetched_emails_from_sg[i];
            allFetchSuppressionReportingPromises.push(fetchEmailData(data));
            allFetchSuppressionReportingPromises.push(delay);
        }






        var allFetchPromises = Q.allSettled(allFetchSuppressionReportingPromises);
        allFetchPromises.then(function(results){
            console.log("All allFetchSuppressionReportingPromises done!");

            db.close();

            return res.status(200).send({success:true});
        });
        //res.status(200).send({success:true});
    });




});




module.exports = router;