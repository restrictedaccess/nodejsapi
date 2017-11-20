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
var payments_queue = Queue('xero_sync_all_payments_queue', 6379, '127.0.0.1');

var paymentsDef = require("./invoice");
var xeroSyncAllPaymentsSchema = require("../../models/XeroSyncAllPayments");
var invoiceSchema = require("../../models/Invoice");

payments_queue.process(function(job, done){
    console.log("Processing all payments to be synced in xero");


    var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");

    var XeroSyncAllPayments = db_xero.model("XeroSyncAllPayments", xeroSyncAllPaymentsSchema);
    var InvoiceModel = db.model("Invoice", invoiceSchema);

    var XeroSyncAllPaymentsObj = new XeroSyncAllPayments();

    db_xero.once("open", function(){
        db_xero.close();
    });


    var limit = 30;

    function createBatch(defer_batch, invoices_to_sync, i){
        if(invoices_to_sync[i]){
            Q.delay(1000).then(function(){

                var order_id = invoices_to_sync[i].order_id;


                paymentsDef.processPerPaidInvoice(
                    {
                        data: {
                            processInvoice: {
                                order_id: order_id
                            },
                            isBatch: true
                        }
                    },
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


        XeroSyncAllPaymentsObj.getAllData(true).then(function(syncedInvoices){
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
                        "status": "paid"
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
                        paymentsDef.processBatchPayments(
                            {},
                            function(batch_error, batch_response){
                                console.log("Saving synced payments");

                                var ids = invoices_to_sync.map(function(item){
                                    return (item.order_id);
                                });

                                var all_saving_promises = [];
                                for(var i = 0;i < ids.length;i++){
                                    all_saving_promises.push(XeroSyncAllPaymentsObj.saveData(
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
                    console.log("All Payments synced to xero!");
                    done();
                }

            });

        });

    }


    db.once("open", function(){
        syncInvoices();


    });



});

module.exports = payments_queue;