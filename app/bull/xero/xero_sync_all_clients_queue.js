var express = require('express');
var console = require('console');
var configs = require("../../config/configs");
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');
var fs = require('fs');


var mongoCredentials = configs.getMongoCredentials();

var Queue = require('bull');
var cluster = require("cluster");
var numWorkers = 4;
var clients_queue = Queue('xero_sync_all_clients_queue', 6379, '127.0.0.1');

var clientsDef = require("./client");
var xeroSyncAllClientsSchema = require("../../models/XeroSyncAllClients");
var clientSchema = require("../../models/Client");

clients_queue.process(function(job, done){
    console.log("Processing all clients to be synced in xero");


    var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");

    var XeroSyncAllClients = db_xero.model("XeroSyncAllClients", xeroSyncAllClientsSchema);
    var ClientsModel = db.model("Client", clientSchema);

    var xeroSyncAllClientsObj = new XeroSyncAllClients();

    db_xero.once("open", function(){
        db_xero.close();
    });


    var limit = 30;

    function createBatch(defer_batch, clients_to_sync, i){
        if(clients_to_sync[i]){
            Q.delay(1000).then(function(){

                var client_id = clients_to_sync[i].client_id;


                clientsDef.processPerClient(
                    {
                        data: {
                            processClient: {
                                id: client_id
                            },
                            isBatch: true
                        }
                    },
                    function(batch_error, batch_result){
                        //defer.resolve(batch_result);
                        createBatch(defer_batch, clients_to_sync, ++i);
                    }
                );
            });

        } else{
            console.log("all batches created!");
            defer_batch.resolve(clients_to_sync);
        }


    }

    function syncClients(){
        console.log("Fetching " + limit + " clients to sync");


        xeroSyncAllClientsObj.getAllData(true).then(function(syncedClients){
            var ids = [];

            if(syncedClients.length > 0){

                ids = syncedClients.map(function(item){
                    return parseInt(item.client_id);
                });
            }

            ClientsModel.find({
                "client_id": {
                    $nin: ids
                },
                $and : [
                    {

                        "client_doc.client_fname": {
                            $ne: null
                        },
                        "client_doc.client_fname": {
                            $ne: ""
                        },


                        "client_doc.client_lname": {
                            $ne: null
                        },
                        "client_doc.client_lname": {
                            $ne: ""
                        },


                        "lead.fname": {
                            $ne: null
                        },
                        "lead.fname": {
                            $ne: ""
                        },
                        "lead.fname": {
                            $exists: true
                        },


                        "lead.lname": {
                            $ne: null
                        },
                        "lead.lname": {
                            $ne: ""
                        },
                        "lead.lname": {
                            $exists: true
                        },
                    }
                ]
            }).sort({client_id: -1})
                .limit(limit)
                .select({client_id: 1})
                .lean().exec(function (err, clients_to_sync){
                if(clients_to_sync.length > 0){
                    var all_batch_saving = [];

                    console.log("Creating 30 batches to sync to xero");


                    var defer_batch = Q.defer();

                    createBatch(defer_batch, clients_to_sync, 0);

                    defer_batch.promise.then(function(results){
                        clientsDef.processBatchClients(
                            {},
                            function(batch_error, batch_response){
                                console.log("Saving synced clients");

                                var ids = clients_to_sync.map(function(item){
                                    return parseInt(item.client_id);
                                });

                                var all_saving_promises = [];
                                for(var i = 0;i < ids.length;i++){
                                    all_saving_promises.push(xeroSyncAllClientsObj.saveData(
                                        {
                                            client_id: parseInt(ids[i]),
                                            date_synced: configs.getDateToday()
                                        }
                                    ));
                                }

                                Q.allSettled(all_saving_promises).then(function(saving_results){
                                    syncClients();
                                });


                            }
                        );
                    });

                } else{
                    db.close();
                    console.log("All Clients synced to xero!");
                    done();
                }

            });

        });

    }


    db.once("open", function(){
        syncClients();


    });



});

module.exports = clients_queue;