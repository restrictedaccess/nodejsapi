var express = require('express');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');

var Queue = require('bull');
var configs = require("../config/configs");
var asl_candidates_queue = Queue('asl_candidates_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();


var jobSubCategoryApplicantsSchema = require("../mysql/JobSubCategoryApplicants");


var candidatesProcessDef = require("../bull/candidates");

asl_candidates_queue.process(function(job, done){
    try{

        console.log("Processing all ASL candidates");

        var aslSolrSyncedCandidates = require("../models/ASLSolrSyncedCandidates");

        var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
        var ASLSolrSyncedCandidates = db.model("ASLSolrSyncedCandidates", aslSolrSyncedCandidates);

        db.once("open", function(){

            ASLSolrSyncedCandidates.find().lean().exec(function(err, foundDocs){
                var ids = foundDocs.map(function(currentItem){
                    return currentItem.candidate_id
                });

                var where = {};

                if(ids.length > 0){
                    where = {
                        userid: {
                            $notIn: ids
                        }
                    };
                }


                jobSubCategoryApplicantsSchema.findAll({
                    group: ['userid'],
                    attributes: ["userid"],
                    where: where
                }).then(function(foundObjects){
                    console.log(foundObjects.length);

                    var sync_queue = require("./candidates_queue");

                    function syncCandidate(i){


                        if(i < foundObjects.length){
                            Q.delay(200).then(function(){

                                var current_id = foundObjects[i].userid;
                                console.log("syncing candidate " + current_id);

                                var to_save = {
                                    candidate_id: parseInt(current_id),
                                    date_synced: configs.getDateToday()
                                };

                                //insert
                                newRecord = new ASLSolrSyncedCandidates(to_save);

                                newRecord.save(function(err){
                                    if(err){
                                        console.log(err);
                                    }

                                    console.log("saved lookup asl solr syncing");
                                });


                                var candidate = {
                                    id: parseInt(current_id),
                                };


                                sync_queue.add({processCandidate:candidate, skip_lookup: true});

                                syncCandidate(i+1);
                           });

                        } else{
                            db.close();
                            console.log("Done sending sync all asl candidates");
                            done();
                        }

                    }

                    syncCandidate(0);

                });
            });


        });
    } catch(major_error){
        console.log(major_error);
    }


});

module.exports = asl_candidates_queue;