/**
 * Created by JMOQUENDO on 6/27/17.
 */

var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var moment = require('moment');
var moment_tz = require('moment-timezone');
var njsUrl = "http://127.0.0.1:3000";
var request = require('request');
//leads schema
var leads_info = require("../mysql/Lead_Info");
var invoiceComponent = require("../components/Invoice");
var invoice_creation_main = require("../bull/invoice-auto-creation-main");
var invoice_email_reminder_main = require("../bull/invoice-email-reminder-main");

//client_settings Schema
var client_settings = require("../models/Client");
var client_docs = require("../models/Invoice");

//schema for invoice creation track
var invoiceCreationTrack = require("../models/InvoiceCreationTrack");




router.all("*", function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});


router.post("/fetch-track", function (req, res, next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);
    var Client_Docs = db.model("Client_Docs", client_docs);
    var nPage = 20;
    var page = (req.body.page ? req.body.page : 1);
    var numberDocs = 0;

    var isCount = (req.body.count ? req.body.count : "no");

    var search_key_filter = {};
    var q_query = [];
    var and_query = [];
    var total_invoices_amount = [];

    var endOfMonth = new Date(moment().endOf('month').format('YYYY-MM-DD 00:00:00'));
    var filter = {
        "status.success": true,
        "date_created": {
            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
        }
    };

    var invoiceTrackProcess = "";
    var invoiceTrackCount = "";


    if (req.body.search) {
        if (req.body.isOrderDate) {

            if (req.body.status) {
                search_key_filter = {
                    "date_created": {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD 23:59:59")),
                    },
                    "queue": req.body.status.toLowerCase(),
                    "status.success": true
                }
            }
            else {
                search_key_filter = {
                    "date_created": {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD 23:59:59")),
                    },
                    "status.success": true
                }
            }


        }
        else if (req.body.isDueDate) {
            if (req.body.status) {
                search_key_filter = {
                    "due_date": {
                        '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD 23:59:59"))
                    },
                    "queue": req.body.status.toLowerCase(),
                    "status.success": true
                }
            }
            else {
                search_key_filter = {
                    "due_date":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status.success": true
                }
            }

        }
        else if (req.body.isOrderDate && req.body.isDueDate) {
            if (req.body.status) {
                search_key_filter = {
                    "date_created": {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD 23:59:59"))
                    },
                    "due_date": {
                        '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD 23:59:59"))
                    },
                    "queue": req.body.status.toLowerCase(),
                    "status.success": true

                }
            }
            else {
                search_key_filter = {
                        "date_created":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD 23:59:59"))
                    },
                        "due_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD 23:59:59"))
                        },
                    "status.success": true

                }
            }


        } else {
            if (req.body.status) {
                search_key_filter = {
                    "status.success": true,
                    "queue": req.body.status.toLowerCase()
                };

            }
            else {
                search_key_filter = {
                    "status.success": true,
                    "date_created": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    }
                };
            }
        }

        and_query.push(search_key_filter);

        if (typeof req.body.searchBox !== "undefined" && req.body.searchBox !== "") {
            var regs = req.body.searchBox.split(" ");

            if (regs.length > 1) {

                for (var i = 0; i < regs.length; i++) {
                    regs[i] = regs[i].trim().toLowerCase();
                }


                q_query = [
                    {"client_names": {"$all": [regs]}}
                ];

                // q_query = [
                //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                // ];
            }
            else {
                q_query = [
                    {"client_fname": new RegExp('^' + req.body.searchBox + '$', "i")},
                    {"client_lname": new RegExp('^' + req.body.searchBox + '$', "i")},
                    {"client_email": new RegExp('^' + req.body.searchBox + '$', "i")},
                    {"order_id": {'$regex': req.body.searchBox, '$options': 'i'}}
                ];


            }

            and_query.push({$or: q_query});
        }

    }

    if (isCount == 'yes') {
        if (req.body.search) {
            invoiceTrackCount = InvoiceCreation.find();
            invoiceTrackCount.and(and_query);
            console.log(and_query);
        }
        else {
            invoiceTrackCount = InvoiceCreation.count(filter);
            console.log(filter);
        }

        try {
            db.once("open", function () {
                invoiceTrackCount.exec(function (err, doc_count) {
                    if (err) {
                        db.close();
                        return res.status(200).send({success: false});
                    }
                    // db.close();
                    if (req.body.search) {
                        numberDocs = doc_count.length;
                    }
                    else {
                        numberDocs = doc_count;
                    }


                    if (numberDocs > 0) {
                        var params = filter;

                        if (req.body.search) {
                            params = search_key_filter;
                        }

                        try {
                            InvoiceCreation.aggregate([
                                {$match: params},
                                {
                                    $group: {
                                        _id: "$currency",
                                        total_amount: {$sum: "$total_amount"}
                                    }
                                }], function (err, result) {

                                if (result) {
                                    total_invoices_amount = result;
                                }
                                InvoiceCreation.aggregate([
                                    {$match:params},
                                    {
                                        $group: {
                                            _id: "$queue",
                                            total_amount: {$sum: 1}
                                        }
                                    }], function (err, queueCount) {

                                    if (queueCount.length > 0) {

                                        queueCount.forEach(function (value, key) {

                                            total_invoices_amount.push({
                                                _id: value._id,
                                                total_amount: value.total_amount
                                            });
                                        });
                                        console.log(total_invoices_amount);

                                    }
                                    getTrackData();
                                });

                            });


                        } catch (e) {
                            console.log(e);
                            return res.status(200).send(e);
                        }


                    }
                    else {
                        getTrackData();
                    }


                });

            });
        } catch (e) {
            console.log(e);
            return res.status(200).send({success: false});
        }

    }
    else {
        db.once("open", function () {
            getTrackData();
        });
    }


    function getTrackData() {


        if (req.body.search) {
            invoiceTrackProcess = InvoiceCreation.find().skip(((page - 1) * nPage)).limit(nPage);
            invoiceTrackProcess.and(and_query);
        }
        else {
            invoiceTrackProcess = InvoiceCreation.find(filter).skip(((page - 1) * nPage)).limit(nPage);
        }

        try {
            invoiceTrackProcess.lean().exec(function (err, doc) {
                if (err) {
                    db.close();
                    return res.status(200).send({success: false});
                }

                console.log(doc.length);
                if (doc.length > 0) {
                    function getClientDocs(i) {
                        if (i < doc.length) {
                            var item = doc[i];
                            var searchKey = {order_id: item.order_id};
                            try {
                                Client_Docs.findOne(searchKey).exec(function (err, clientDocObject) {

                                    if (err) {
                                        console.log(err);
                                        getClientDocs(i + 1);
                                    }
                                    if(clientDocObject)
                                    {
                                        item.invoice_status = (clientDocObject.status  ? clientDocObject.status : "");
                                        item.invoice_amount = (clientDocObject.total_amount  ? clientDocObject.total_amount : "");
                                        item.invoice_currency = (clientDocObject.currency ? clientDocObject.currency : "");
                                        item.hasNotes = (typeof clientDocObject.comments !== "undefined" ? clientDocObject.comments.length : null);
                                    }
                                    getClientDocs(i + 1);
                                });
                            } catch (e) {
                                console.log(e);
                                getClientDocs(i + 1);
                            }
                        }
                        else {
                            db.close();
                            return res.status(200).send({
                                success: true,
                                data: doc,
                                count: numberDocs,
                                total_invoice_amount: total_invoices_amount
                            });
                        }
                    }

                    getClientDocs(0);
                }
                else {
                    db.close();
                    return res.status(200).send({success: true, data: doc, count: numberDocs});
                }
            });

        } catch (e) {
            console.log(e);
            return res.status(200).send({success: false});
        }
    }


});

router.get("/generate-invoices", function (req, res, next) {

    var clientID = (req.query.id ? req.query.id : null );

    // console.log(clientID);

    invoice_creation_main.add({id:clientID});

    return res.status(200).send({success: true, msg: "Bull process started"});
});


router.get("/test-auto", function (req, res, next) {

    function delay() {
        return Q.delay(100);
    }

    var items = [];
    var client_id = 10594;

    var itemId = 0;
    var willfulfillItemsDeferred = Q.defer();
    var willfulfillItems = willfulfillItemsDeferred.promise;
    items.push(willfulfillItems);
    items.push(delay);


    var item_added = [];
    var invoiceObject = {};
    var historyObject = {};

    var invoice = new invoiceComponent();
    // var month_year = invoice.ts_date;
    // var month_year2 = invoice.currency_date;
    var month_year = "2017-01-01";
    var month_year2 = "2016-12-01";

    function getClientDetails() {
        var callbackClient = function (response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                var data = JSON.parse(str)
                invoice.client = data.result;
                invoice.getTaxInvoice();
                setTimeout(function () {

                    var invoiceData = invoice.toJSON();
                    // return res.status(200).send(invoiceData);

                    function callBackInvoice(error, response, body) {
                        if (!error) {
                            var callbackSync = function (response) {
                                var str = '';
                                response.on('data', function (chunk) {
                                    str += chunk;
                                });
                                response.on('end', function () {

                                    // invoice.send();
                                    setTimeout(function () {
                                        return res.status(200).send({success: true, data: body});
                                    }, 500);

                                });
                            };

                            http.get(njsUrl + "/invoice/sync-daily-rates?order_id=" + body.order_id, callbackSync);
                        }
                        else {
                            console.log('Error happened: ' + error);
                            return res.status(200).send({success: false});
                        }
                    }

                    var options = {
                        method: 'POST',
                        url: njsUrl + '/invoice/save/',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: invoiceData
                    };

                    request(options, callBackInvoice);

                }, 500);

            });

        };


        http.get(njsUrl + '/invoice/get-client-invoices/?id=' + client_id, callbackClient);


    }

    // getClientDetails();
    getInvoiceItems();

    function getInvoiceItems() {

        //get items for timesheet (-30 days group)
        var callback = function (response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                var data = JSON.parse(str)

                if (typeof data.result !== "undefined" && data.result.length > 0) {
                    item_added.push(data.result);
                    var result_item = data.result;

                    function getItems(i) {
                        if (i < result_item.length) {
                            var item = result_item[i];
                            var invoice_items = {};
                            itemId = i + 1;
                            invoice_items.item_id = itemId;
                            invoice_items.description = item.description;
                            invoice_items.item_type = item.item_type;
                            invoice_items.qty = item.qty;
                            invoice_items.unit_price = item.staff_hourly_rate;
                            invoice_items.selected_date = {
                                startDate: new Date(item.start_date),
                                endDate: new Date(item.end_date)
                            };
                            invoice_items.selected = true;
                            invoice_items.subcontractors_id = item.subcontractors_id;
                            invoice_items.current_rate = item.current_rate;
                            invoice_items.staff_name = item.staff_name;
                            invoice_items.start_date = new Date(item.start_date);
                            invoice_items.end_date = new Date(item.end_date);
                            invoice.invoice_item.push(invoice_items);
                            getItems(i + 1);
                        }
                        else {


                            http.get(njsUrl + '/timesheet/currency-adjustments?client_id=' + client_id + '&month_year=' + month_year2, callback2);
                        }
                    }

                    getItems(0);

                }
                else {
                    return res.status(200).send({success: false, msg: "No data Found", data: data});
                }


            });
        };


        var callback2 = function (response) {
            var str = '';

            //another chunk of data has been recieved, so append it to `str`
            response.on('data', function (chunk) {
                str += chunk;
            });

            //the whole response has been recieved, so we just print it out here
            response.on('end', function () {
                var data = JSON.parse(str)

                if (typeof data.result !== "undefined" && data.result.length > 0) {
                    item_added.push(data.result);

                    var result_item = data.result;

                    function getItems(i) {
                        if (i < result_item.length) {
                            var item = result_item[i];
                            var invoice_items = {};
                            itemId = itemId + 1;
                            invoice_items.item_id = itemId;
                            invoice_items.description = item.description;
                            invoice_items.item_type = item.item_type;
                            invoice_items.qty = item.qty;
                            invoice_items.unit_price = parseFloat(item.currency_adjustment.toFixed(4));
                            invoice_items.selected_date = {
                                startDate: new Date(item.start_date),
                                endDate: new Date(item.end_date)
                            };
                            invoice_items.selected = true;
                            invoice_items.subcontractors_id = item.subcontractors_id;
                            invoice_items.current_rate = item.current_rate;
                            invoice_items.staff_name = item.staff_name;
                            invoice_items.start_date = new Date(item.start_date);
                            invoice_items.end_date = new Date(item.end_date);
                            invoice.invoice_item.push(invoice_items);
                            getItems(i + 1);
                        }
                        else {

                            willfulfillItemsDeferred.resolve(item_added);
                        }
                    }

                    getItems(0);

                }
                else {
                    return res.status(200).send({success: false, msg: "No data Found 2", data: data});
                }


            });

        };

        http.get(njsUrl + '/timesheet/invoice-items?client_id=' + client_id + '&month_year=' + month_year, callback);


        //all promises are done
        var allPromises = Q.allSettled(items);

        allPromises.then(function (results) {


            console.log("All Promises Done");


            getClientDetails();
            // return res.status(200).send(invoice.toJSON());

        });
    }
});


router.post("/send-invoice", function (req, res, next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);

    var invoice_data = (req.body.invoice_data ? req.body.invoice_data : null);

    if (typeof invoice_data.order_id == "undefined") {
        return res.status(200).send({success: false, msg: "No order id"});
    }


    var callBackDetails = function (response) {
        var str = '';
        response.on('data', function (chunk) {
            str += chunk;
        });

        response.on('end', function () {
            var data = JSON.parse(str);

            if (data.success) {

                if (typeof data.result !== "undefined") {
                    var params = {
                        mongo_id: data.result._id,
                        admin: "System Generated",
                        custom: false
                    };

                    var options = {
                        method: 'POST',
                        url: njsUrl + '/send/invoice-with-attachment-per-recipient/',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        json: params
                    };

                    request(options, callBackSend);

                    function callBackSend(error, response, body) {
                        if (!error) {
                            console.log("Success Sending of email");

                            var data = {};

                            data.invoice_data = invoice_data;

                            var options = {
                                method: 'POST',
                                url: njsUrl + '/invoice-auto-creation/save-track/',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                json: data
                            };

                            request(options, callBackTrack);

                            function callBackTrack(error, response, body) {
                                if (!error) {
                                    console.log("adding track");

                                    if (body.success) {
                                        console.log('pasok sending');
                                        return res.status(200).send({success: true});
                                    }
                                    else {
                                        return res.status(200).send({success: false});
                                    }


                                }
                                else {
                                    console.log('Error happened: ' + error);
                                    return res.status(200).send({success: false});
                                }

                            }

                        }
                        else {
                            console.log('Error happened: ' + error);
                            return res.status(200).send({success: false});
                        }

                    }
                }
            }


        });
    };

    //get invoice details from mongo
    http.get(njsUrl + "/invoice/get-invoice-details/?order_id=" + invoice_data.order_id, callBackDetails);
});

router.post("/save-track", function (req, res, next) {
    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);

    var invoice_data = (req.body.invoice_data ? req.body.invoice_data : null);


    if (typeof invoice_data.order_id == "undefined") {
        return res.status(200).send({success: false, msg: "No order id"});
    }


    try {
        invoice_data.queue = "sent";
        var filter = {order_id: invoice_data.order_id};
        db.once("open", function () {
            InvoiceCreation.findOneAndUpdate(filter, invoice_data, {upsert: true}, function (err, doc) {
                if (err) {
                    db.close();
                    console.log(err);
                    return res.status(200).send({success: false, msg: err});
                }

                db.close();
                console.log("Success adding track");
                return res.status(200).send({success: true, data: doc});
            });

        });

    } catch (e) {
        console.log(e);
        return res.status(200).send({success: false});
    }


});


router.get("/update_dates", function (req, res, next) {

    var invoice_date = (typeof req.query.invoice_date ? req.query.invoice_date : null);
    var due_date = (typeof req.query.due_date ? req.query.due_date : null);
    var order_id = (typeof req.query.order_id ? req.query.order_id : null);

    if(!invoice_date && !due_date)
    {
        return res.status(200).send({success:false,msg:"check dates"});
    }


    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);
    var Client_Docs = db.model("Client_Docs", client_docs);


    invoice_date = new Date(moment_tz(invoice_date).format("YYYY-MM-DD 00:00:00"));
    due_date = new Date(moment_tz(due_date).format("YYYY-MM-DD 00:00:00"));

    var filter = {
        "status.success": true,
        "date_created": {
            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
            '$lte': new Date(moment_tz().format("YYYY-MM-28 23:59:59"))
        }
    };

    if(order_id)
    {
        filter = {
            "status.success": true,
            "date_created": {
                '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                '$lte': new Date(moment_tz().format("YYYY-MM-28 23:59:59"))
            },
            "order_id":order_id
        };
    }


    db.once('open',function(){

        try{


            var update_date_doc = {
                date_created:invoice_date,
                invoice_date:invoice_date,
                due_date:due_date
            };

            var client_doc_update_date = {

                added_on : moment(invoice_date).toDate(),
                added_on_unix : moment(invoice_date).unix(),
                pay_before_date : moment(due_date).toDate(),
                pay_before_date_unix : moment(due_date).unix()
            };


            InvoiceCreation.find(filter).lean().exec(function(err,documents){
                function updateDatesTrack(i)
                {
                    if(i < documents.length)
                    {
                        item = documents[i];

                        try {
                            InvoiceCreation.findOneAndUpdate({order_id:item.order_id}, update_date_doc, {upsert: true}, function (err, doc) {

                                if (err) {
                                    db.close();
                                    console.log(err);
                                    return res.status(200).send({success: false, msg: err});
                                }

                                try {

                                    Client_Docs.findOneAndUpdate({order_id:item.order_id},client_doc_update_date,{upsert: true}, function (err, doc) {
                                        if (err) {
                                            db.close();
                                            console.log(err);
                                            return res.status(200).send({success: false, msg: err});
                                        }

                                        updateDatesTrack(i + 1);
                                    });

                                }catch(e)
                                {
                                    console.log(e + "3");
                                    db.close();
                                    return res.status(200).send({success: false, msg: err});
                                }



                            });

                        }catch(e)
                        {
                            console.log(e + "2");
                            db.close();
                            return res.status(200).send({success: false, msg: err});
                        }
                    }
                    else {

                        db.close();
                        console.log('done');
                    }

                }

                updateDatesTrack(0)

            });


            return res.status(200).send({success: true, msg: "updating.."});

        }catch(e)
        {
            console.log(e);
            db.close();
            return res.status(200).send({success: false, msg: err});
        }

    });

});


router.get("/invoice-email-reminder", function (req, res, next) {

    var order_id = (typeof req.query.order_id !== 'undefined' ? req.query.order_id : null);
    var resend = (typeof req.query.resend !== 'undefined' ? req.query.resend : false);
    invoice_email_reminder_main.add({order_id:order_id,resend:resend});
    return res.status(200).send(true);

})




module.exports = router;