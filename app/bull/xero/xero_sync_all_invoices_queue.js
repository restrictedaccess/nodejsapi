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
var invoices_queue = Queue('xero_sync_all_invoices_queue', 6379, '127.0.0.1');

var invoicesDef = require("./invoice");
var xeroSyncAllInvoicesSchema = require("../../models/XeroSyncAllInvoices");
var invoiceSchema = require("../../models/Invoice");

invoices_queue.process(function(job, done){
    console.log("Processing all invoices to be synced in xero");


    var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");

    var XeroSyncAllInvoices = db_xero.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);
    var InvoiceModel = db.model("Invoice", invoiceSchema);

    var xeroSyncAllInvoicesObj = new XeroSyncAllInvoices();

    db_xero.once("open", function(){
        db_xero.close();
    });


    var limit = 30;

    function createBatch(defer_batch, invoices_to_sync, i){
        if(invoices_to_sync[i]){
            Q.delay(1000).then(function(){

                var order_id = invoices_to_sync[i].order_id;

                var data_to_send = {
                    data: {
                        processInvoice: {
                            order_id: order_id
                        },
                        isBatch: true,
                    }
                };

                if(job.data.sync_without_status){
                    data_to_send.data.sync_without_status = job.data.sync_without_status;
                }

                invoicesDef.processPerInvoice(
                    data_to_send,
                    function(batch_error, batch_result){
                        //defer.resolve(batch_result);
                        createBatch(defer_batch, invoices_to_sync, ++i);
                    }
                );
            });

        } else{
            console.log("all batches created!");
            defer_batch.resolve(invoices_to_sync);
        }


    }

    function syncInvoices(){
        console.log("Fetching " + limit + " invoices to sync");


        xeroSyncAllInvoicesObj.getAllData(true).then(function(syncedInvoices){
            var ids = [];

            if(syncedInvoices.length > 0){

                ids = syncedInvoices.map(function(item){
                    return (item.order_id);
                });
            }

            InvoiceModel.find({
                $and : [
                    {
                        "order_id": {
                            $nin: ids
                        },

                        "order_id": {
                            $ne: null
                        },
                        "order_id": {
                            $ne: ""
                        },
                        "order_id": {
                            $exists: true
                        },
                        "items": {
                            $not: {
                                $size: 0
                            }
                        },
                    }
                ]
            }).sort({order_id: -1})
                .limit(limit)
                .select({order_id: 1})
                .lean().exec(function (err, invoices_to_sync){
                if(invoices_to_sync.length > 0){
                    var all_batch_saving = [];

                    console.log("Creating 30 batches to sync to xero");


                    var defer_batch = Q.defer();

                    createBatch(defer_batch, invoices_to_sync, 0);

                    defer_batch.promise.then(function(results){
                        invoicesDef.processBatchInvoices(
                            {},
                            function(batch_error, batch_response){
                                console.log("Saving synced invoices");

                                var ids = invoices_to_sync.map(function(item){
                                    return (item.order_id);
                                });

                                var all_saving_promises = [];
                                for(var i = 0;i < ids.length;i++){
                                    all_saving_promises.push(xeroSyncAllInvoicesObj.saveData(
                                        {
                                            order_id: (ids[i]),
                                            date_synced: configs.getDateToday()
                                        }
                                    ));
                                }

                                Q.allSettled(all_saving_promises).then(function(saving_results){
                                    syncInvoices();
                                });


                            }
                        );
                    });

                } else{
                    db.close();
                    console.log("All Invoices synced to xero!");
                    done();
                }

            });

        });

    }


    db.once("open", function(){
        syncInvoices();


    });



});

module.exports = invoices_queue;