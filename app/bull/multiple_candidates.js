var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');



var mongoCredentials = configs.getMongoCredentials();




module.exports = {
    processMultipleCandidatesByDateCluster: function (job, done) {

        if(typeof job.data.sync_all == "undefined"){
            console.log("sync_all is required");
            done();
            return;
        }

        function shortDelay() {
            //10 seconds
            return Q.delay(50);
        }
        function delay() {
            //10 seconds
            return Q.delay(60000);
        }

        var solrCandidatesSchema = require("../mysql/SolrCandidates");
        var solrSyncedByDatesSchema = require("../models/SolrSyncDate");


        var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
        var SolrSyncDate = db.model("SolrSyncDate", solrSyncedByDatesSchema);


        var candidatesQueue = require("../bull/candidates_queue");

        var candidatesProcessDef = require("../bull/candidates");

        var date_creator = new SolrSyncDate();


        function addJob(candidate){

            var addJobDeferred = Q.defer();
            var addJobPromise = addJobDeferred.promise;


            candidatesQueue.add({processCandidate:candidate, skip_lookup: true});
            addJobDeferred.resolve(true);

            return addJobPromise;
        }




        function spawnProcess(current_item, index){
            var delayPromise = Q.delay(60000 * index);

            delayPromise.then(function(afterDelay){
                var current_process = solrCandidatesSchema.getCandidatesToSync(current_item.date_from, current_item.date_to);

                current_process.then(function(candidates_to_sync){

                    var all_job_add_promises = [];

                    if(candidates_to_sync.length > 0){
                        console.log("starting");
                        console.log(current_item);
                        for(var j = 0;j < candidates_to_sync.length;j++){
                            var current_candidate = candidates_to_sync[j];
                            var candidate = {
                                id: parseInt(current_candidate.dataValues.userid)
                            };


                            all_job_add_promises.push(addJob(candidate).delay(100));
                            //all_job_add_promises.push(shortDelay());
                            //
                            // if(j > 3){
                            //     break;
                            // }
                        }

                    }


                    var allJobPromise = Q.allSettled(all_job_add_promises);
                    allJobPromise.then(function (results) {
                        console.log("jobs added to queue!");

                        updateProcessed(current_item);
                    });

                });
            });


            console.log("waiting " + ((60000 * index) / 1000) + " seconds before syncing the next");
            return delayPromise;
        }

        function updateProcessed(data){

            var updateDeferred = Q.defer();
            var updatePromise = updateDeferred.promise;

            var db_inner = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
            var SolrSyncDateInner = db_inner.model("SolrSyncDate", solrSyncedByDatesSchema);


            db_inner.once("open", function(){

                SolrSyncDateInner.findOne({
                    date_from: data.date_from,
                    date_to: data.date_to
                }).exec(function(err, foundDoc){
                    if(foundDoc){
                        foundDoc.processed = true;
                        foundDoc.save(function(err){
                            db_inner.close();
                            console.log("date processed!");
                            console.log(data);
                            updateDeferred.resolve(true);
                        });
                    } else{
                        db_inner.close();
                        updateDeferred.resolve(true);
                    }
                });

            });

            return updatePromise;
        }


        db.once("open", function(){

            date_creator.createDates().then(function(datesCreated){
                SolrSyncDate.find({
                    processed: false
                }).lean().sort({date_from:-1}).exec(function(err, foundDoc){
                    db.close();
                    if(foundDoc.length > 0){


                        var all_process_promise = [];


                        for(var i = 0;i < foundDoc.length;i++){
                            var current_item = foundDoc[i];

                            all_process_promise.push(spawnProcess(current_item, i));
                            //all_process_promise.push(Q.delay(120000 * i));




                            //break;
                        }


                        var allPromise = Q.allSettled(all_process_promise);
                        allPromise.then(function (results) {
                            console.log("all processes queued!");
                            done();
                        });


                    } else{
                        console.log("no more dates to process");
                        done();
                    }

                });

            });
        });
    }
}