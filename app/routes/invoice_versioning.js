/**
 * Created by joenefloresca on 20/06/2017.
 */
var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();

var invoiceModificationsSchema = require("../models/InvoiceModifications");
var invoiceVersionsSchema = require("../models/InvoiceVersions");

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');

router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

router.post("/sync-modification", function (req, res, next) {

    var result = req.body;

    if(!result.invoice_number && !result.date_updated && !result.status && !result.updated_by_admin_id && !result.updated_by_admin_name){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }

    var params = {
        "invoice_number": result.invoice_number,
        "date_updated": result.date_updated,
        "status": result.status,
        "updated_by_admin_id": result.updated_by_admin_id,
        "updated_by_admin_name": result.updated_by_admin_name
    };

    var filter = {
        invoice_number: result.invoice_number
    };

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceModificationSchema = db.model("InvoiceModificationSchema", invoiceModificationsSchema);

    db.once('open', function () {
        // Insert new record
        var invoiceMod = new InvoiceModificationSchema(params);
        invoiceMod.save(function (err) {
            if (err) {
                db.close();
                console.log(err);
                return res.status(200).send({success: false, result: "Invoice not inserted"});
            } else {
                db.close();
                return res.status(200).send({success: true, result: "Invoice inserted"});
            }
        });
    });

});

router.get("/get-latest-version", function (req, res, next) {
    var result = req.query;

    if(!result.order_id){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }
    var filter = {
        order_id: result.order_id
    };


    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceVersionsSchema = db.model("InvoiceVersionsSchema", invoiceVersionsSchema);

    db.once('open', function () {
        // Get version

        InvoiceVersionsSchema.findOne(filter).sort({version: -1}).exec(function (err, data) {
            if(data) {
                db.close();

                return res.status(200).send({success: true, result: data});
            } else {

                db.close();
                return res.status(200).send({success: false, result: "No record found"});
            }
        });
    });
});

router.post("/sync-version", function (req, res, next) {

    var result = req.body;

    if(!result.order_id && !result.version){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceVersionsSchema = db.model("InvoiceVersionsSchema", invoiceVersionsSchema);

    db.once('open', function () {
        // Insert new record
        var invoiceVersion = new InvoiceVersionsSchema(result);
        invoiceVersion.save(function (err) {
            if (err) {
                db.close();
                console.log("Error inserting sync version");
                console.log(err);
                return res.status(200).send({success: false, result: "Invoice not inserted"});
            } else {
                db.close();
                return res.status(200).send({success: true, result: "Invoice version inserted"});
            }
        });
    });

});

router.get("/get-all-versions", function (req, res, next) {
    var result = req.query;

    if(!result.order_id){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }
    var filter = {
        order_id: result.order_id
    };

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceVersionsSchema = db.model("InvoiceVersionsSchema", invoiceVersionsSchema);

    db.once('open', function () {
        // Get version
        InvoiceVersionsSchema.find(filter).sort({version: -1}).exec(function (err, data) {
            if(data) {
                db.close();
                return res.status(200).send({success: true, result: data});
            } else {
                db.close();
                return res.status(200).send({success: false, result: "No record found"});
            }
        });
    });
});


router.get("/get-data-by-version", function (req, res, next) {
    var result = req.query;

    if(!result.order_id){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }

    var filter = {
        order_id: result.order_id,
        version: result.version
    };

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceVersionsSchema = db.model("InvoiceVersionsSchema", invoiceVersionsSchema);

    db.once('open', function () {
        InvoiceVersionsSchema.findOne(filter).exec(function (err, data) {
            if(data) {
                db.close();
                return res.status(200).send({success: true, result: data});
            } else {
                db.close();
                return res.status(200).send({success: false, result: "No record found"});
            }
        });
    });
});



router.get("/clear-invoice-modifications", function (req, res, next) {
    var result = req.query;

    if(!result.order_id){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }
    var filter = {
        order_id: result.order_id
    };

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceModificationSchema = db.model("InvoiceModificationSchema", invoiceModificationsSchema);

    db.once('open', function () {
        // Clear modification
        InvoiceModificationSchema.update({status:'Pending'}, {status: 'Done'}, {multi: true},
            function(err, data) {
                if(!err){
                    db.close();
                    return res.status(200).send({success: true, result: "Invoice Modifications Cleared"});
                } else {
                    db.close();
                    return res.status(200).send({success: false, result: "Error clearing modifications"});
                }

            }
        );

    });
});

router.get("/has-modification", function (req, res, next) {

    var result = req.query;

    if(!result.order_id){
        return res.status(200).send({success: false, result: "Missing parameters"});
    }
    var filter = {
        invoice_number: result.order_id,
        status: "Pending",
    };

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");
    var InvoiceModificationSchema = db.model("InvoiceModificationSchema", invoiceModificationsSchema);

    InvoiceModificationSchema.findOne(filter).exec(function (err, data) {
        if(data) {
            db.close();
            return res.status(200).send({success: true, result: true});
        } else {
            db.close();
            return res.status(200).send({success: false, result: false});
        }
    });


});


module.exports = router;