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




var mongoCredentials = configs.getMongoCredentials();

var xeroContactsQueue = require("../bull/xero/xero_clients_queue");
var xeroBatchContactsQueue = require("../bull/xero/xero_batch_clients_queue");

var xeroInvoiceQueue = require("../bull/xero/xero_invoice_queue");
var xeroBatchInvoiceQueue = require("../bull/xero/xero_batch_invoice_queue");

var xeroPaymentQueue = require("../bull/xero/xero_payment_queue");
var xeroBatchPaymentsQueue = require("../bull/xero/xero_batch_payment_queue");


var xero_sync_all_clients_queue = require("../bull/xero/xero_sync_all_clients_queue");
var xero_sync_all_invoices_queue = require("../bull/xero/xero_sync_all_invoices_queue");
var xero_sync_all_payments_queue = require("../bull/xero/xero_sync_all_payments_queue");




router.all("*", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});




/*
 * Method for syncing client(s) to xero as Contact
 * @url http://test.njs.remotestaff.com.au/xero/sync-clients/
 *
 */
router.get("/sync-clients", function (req, res, next) {

    if(!req.query.client_id){
        return res.status(200).send({success:false, error: ["client_id is required!"]});
    }



    var data_to_send = {
        processClient:{
            id: req.query.client_id
        }
    };

    if(req.query.isBatch){
        data_to_send.isBatch = req.query.isBatch;
    }


    xeroContactsQueue.add(data_to_send);

    return res.status(200).send({success:true, result: req.query});
});




/*
 * Method for syncing client(s) to xero as Contact
 * @url http://test.njs.remotestaff.com.au/xero/batch-sync-clients/
 *
 */
router.get("/batch-sync-clients", function (req, res, next) {
    xeroBatchContactsQueue.add({});

    return res.status(200).send({success:true, result: "Syncing all batched clients to xero!"});
});



/*
 * Method for syncing invoice(s) to xero as Contact
 * @url http://test.njs.remotestaff.com.au/xero/sync-invoices-with-status/
 *
 * @param order_id Required The order_id of the invoice
 * @param isBatch Optional will batch invoices first before syncing
 */
router.get("/sync-invoices-with-status", function (req, res, next) {

    if(!req.query.order_id){
        if(!req.query.couch_id){
            return res.status(200).send({success:false, error: ["order_id OR couch_id is required!"]});
        }
    }


    var defer = Q.defer();
    var promise = defer.promise;

    var data_to_send = {};
    if(req.query.order_id) {
        data_to_send = {
            processInvoice:{
                order_id: req.query.order_id
            }
        };
        defer.resolve(data_to_send);
    }

    if(req.query.couch_id){
        var nano = configs.getCouchDb();
        var couch_db = nano.use("client_docs");

        couch_db.get(req.query.couch_id, function(err, body) {
            if(!err){
                data_to_send = {
                    processInvoice:{
                        order_id: body.order_id
                    }
                };

                if(body.status != "cancelled"){
                    data_to_send.do_not_sync = true;
                }

            }
            defer.resolve(data_to_send);
        });
    }



    promise.then(function(data_to_send){
        if(req.query.isBatch){
            data_to_send.isBatch = req.query.isBatch;
        }

        if(!data_to_send.do_not_sync){
            xeroInvoiceQueue.add(data_to_send);
            return res.status(200).send({success:true, result: req.query});
        } else{

            return res.status(200).send({success:false, error:["Invoice is still new or paid"]});
        }



    });

});


/*
 * Method for syncing invoice(s) to xero as Contact
 * @url http://test.njs.remotestaff.com.au/xero/sync-invoices/
 *
 * @param order_id Required The order_id of the invoice
 * @param isBatch Optional will batch invoices first before syncing
 */
router.get("/sync-invoices", function (req, res, next) {

    if(!req.query.order_id){
        if(!req.query.couch_id){
            return res.status(200).send({success:false, error: ["order_id OR couch_id is required!"]});
        }
    }


    var defer = Q.defer();
    var promise = defer.promise;

    var data_to_send = {};
    if(req.query.order_id) {
        data_to_send = {
            processInvoice:{
                order_id: req.query.order_id
            }
        };
        defer.resolve(data_to_send);
    }

    if(req.query.couch_id){
        var nano = configs.getCouchDb();
        var couch_db = nano.use("client_docs");

        couch_db.get(req.query.couch_id, function(err, body) {
            if(!err){
                data_to_send = {
                    processInvoice:{
                        order_id: body.order_id
                    }
                };

                if(body.status == "paid"){
                    //if invoice is already paid
                    data_to_send.isPayment = true;
                }
            }
            defer.resolve(data_to_send);
        });
    }


    promise.then(function(data_to_send){
        if(req.query.isBatch){
            data_to_send.isBatch = req.query.isBatch;
        }

        data_to_send.sync_without_status = true;

        if(data_to_send.isPayment){
            xeroPaymentQueue.add(data_to_send);
        } else{
            xeroInvoiceQueue.add(data_to_send);
        }



        return res.status(200).send({success:true, result: req.query});
    });
});



/*
 * Method for syncing invoice(s) to xero as Invoice(s)
 * @url http://test.njs.remotestaff.com.au/xero/batch-sync-invoices/
 *
 * @param sync_with_status Boolean If set to true will sync invoices with statuses other than new and paid
 *
 */
router.get("/batch-sync-invoices", function (req, res, next) {

    var data_to_send = {};

    if(req.query.sync_with_status){
        data_to_send.sync_with_status = req.query.sync_with_status;
    }

    xeroBatchInvoiceQueue.add(data_to_send);

    return res.status(200).send({success:true, result: "Syncing all batched invoices to xero!"});
});





/*
 * Method for syncing payment(s) to xero as Contact
 * @url http://test.njs.remotestaff.com.au/xero/sync-payments/
 *
 */
router.get("/sync-payments", function (req, res, next) {

    if(!req.query.order_id){
        if(!req.query.couch_id){
            return res.status(200).send({success:false, error: ["order_id OR couch_id is required!"]});
        }
    }


    var defer = Q.defer();
    var promise = defer.promise;

    var data_to_send = {};
    if(req.query.order_id) {
        data_to_send = {
            processInvoice:{
                order_id: req.query.order_id
            }
        };
        defer.resolve(data_to_send);
    }

    if(req.query.couch_id){
        var nano = configs.getCouchDb();
        var couch_db = nano.use("client_docs");

        couch_db.get(req.query.couch_id, function(err, body) {
            if(!err){
                data_to_send = {
                    processInvoice:{
                        order_id: body.order_id
                    }
                };
            }
            defer.resolve(data_to_send);
        });
    }


    promise.then(function(data_to_send){
        if(req.query.isBatch){
            data_to_send.isBatch = req.query.isBatch;
        }


        xeroPaymentQueue.add(data_to_send);

        return res.status(200).send({success:true, result: req.query});
    });
});



/*
 * Method for syncing invoice(s) to xero as Invoice(s)
 * @url http://test.njs.remotestaff.com.au/xero/batch-sync-payments/
 *
 */
router.get("/batch-sync-payments", function (req, res, next) {
    xeroBatchPaymentsQueue.add({});

    return res.status(200).send({success:true, result: "Syncing all batched paid invoices to xero!"});
});



/*
 * Sync all clients to xero
 * @url http://test.njs.remotestaff.com.au/xero/sync-all-clients/
 *
 */
router.get("/sync-all-clients", function (req, res, next) {
    xero_sync_all_clients_queue.add({});

    return res.status(200).send({success:true, result: "Syncing all clients to xero!"});
});




/*
 * Sync all invoices to xero
 * @url http://test.njs.remotestaff.com.au/xero/sync-all-invoices/
 *
 */
router.get("/sync-all-invoices", function (req, res, next) {
    xero_sync_all_invoices_queue.add({sync_without_status: true});

    return res.status(200).send({success:true, result: "Syncing all invoices to xero!"});
});



/*
 * Sync all invoices to xero
 * @url http://test.njs.remotestaff.com.au/xero/sync-all-invoices-with-status/
 *
 */
router.get("/sync-all-invoices-with-status", function (req, res, next) {

    var xeroSyncAllInvoicesSchema = require("../models/XeroSyncAllInvoices");

    var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

    var XeroSyncAllInvoices = db_xero.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);

    var xeroSyncAllInvoicesObj = new XeroSyncAllInvoices();


    db_xero.once("open", function(){
        db_xero.close();
    });
    xeroSyncAllInvoicesObj.cleareAllData().then(function(result){

        xero_sync_all_invoices_queue.add({});

        return res.status(200).send({success:true, result: "Syncing all invoices with status to xero!"});
    });

});


/*
 * Sync all payments to xero
 * @url http://test.njs.remotestaff.com.au/xero/sync-all-payments/
 *
 */
router.get("/sync-all-payments", function (req, res, next) {
    xero_sync_all_payments_queue.add({});

    return res.status(200).send({success:true, result: "Syncing all payments to xero!"});
});



module.exports = router;