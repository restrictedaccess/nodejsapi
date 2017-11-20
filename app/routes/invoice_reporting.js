var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var os = require('os');
var env = require("../config/env")
// var csv=require('fast-csv');

var tmpPath = configs.getTmpFolderPath();


var invoiceSchema = require("../models/Invoice");
var clientSchema = require("../models/Client");
var invoiceRemarksSchema = require("../models/InvoiceRemarks");
var readyForReleaseNoteSchema = require("../models/ReadyToReleaseNotesModel");

router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});




router.get("/loop-client-docs",function(req,res,next){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    var search_key = {};


    var numberofDocs = 0;
    var result = "";
    var error = "";

    var nPage = 200;
    var page = 1;


    var invoiceProcess=Invoice.find(search_key).skip(((page-1)*nPage)).limit(nPage);

    if(req.query.order_id)
    {
        search_key = {order_id:req.query.order_id};
        invoiceProcess = Invoice.find(search_key);
        // return res.status(200).send("Please provide order ID");
    }
    else
    {
        search_key = {last_date_updated:{$exists:false}};
    }


    db.once('open', function(){

        Invoice.count(search_key,function(err,doc_count){

            numberofDocs = doc_count;

            console.log("Total number of documents"+ " " + numberofDocs);

            function restructData(x)
            {
                setTimeout(function () {

                    console.log((x-1)*nPage);
                    if(((x-1)*nPage) < numberofDocs)
                    {
                        page = x;
                        Invoice.find(search_key).skip(((page-1)*nPage)).limit(nPage).sort({added_on_unix:-1}).exec(function(err,doc){
                            if (err) {
                                console.log(err);
                                db.close();
                                result = {success: false, error: err ,msg:""};
                                return res.status(200).send(result);
                            }
                            else
                            {
                                function dataRestruct(i)
                                {
                                    if(i < doc.length)
                                    {

                                        item = doc[i];


                                        if(typeof item.history != "undefined" || item.history)
                                        {
                                            len = (item.history.length > 0 ? item.history.length : 0);


                                            if(len > 0 )
                                            {

                                                newVal = new Date(sortFunc(item.history));

                                                // return res.send(newVal);

                                                item.last_date_updated = newVal;

                                                item.save(function(err){

                                                    if(err){
                                                        error += "Index:"+i+" "+"order_id"+item.order_id +" "+err+" ";
                                                        //console.log(err);
                                                    }else
                                                    {
                                                        console.log("save " + item.order_id);




                                                    }
                                                    dataRestruct(i+1);
                                                });
                                            }
                                            else
                                            {
                                                dataRestruct(i+1);
                                                //result = {success: true,msg:doc[0].order_id + " " + restructured};
                                            }
                                        }
                                        else
                                        {
                                            dataRestruct(i+1);
                                        }
                                    }
                                    else
                                    {
                                        console.log("Done Page: " + page);
                                        if(req.query.order_id)
                                        {
                                            result = {success: true,err:error};
                                            db.close();
                                            return res.status(200).send(result);
                                        }
                                        else
                                        {
                                            page = page + 1;
                                            restructData(page);
                                        }


                                    }

                                }

                                dataRestruct(0);
                            }

                            // return res.status(200).send(doc[0].history[doc[0].history.length-1]);


                        }).catch(function(err) {
                            db.close();
                            return res.send(err);

                        });

                    }
                    else
                    {

                        db.close();
                        result = {success: true};
                        return res.status(200).send(result);

                    }


                },300);//
            }

            restructData(1);





        });
    });
    function sortFunc(dateObject)
    {
        var dateArr = [];

        for(var i = 0 ; i < dateObject.length ; i++)
        {
            if(dateObject[i].timestamp)
            {
                obj = dateObject[i].timestamp.getTime();

                dateArr.push(obj);
            }

        }

        if(dateArr.length > 0 )
        {


            dateArr.sort(function(a, b){return b - a});

            return dateArr[0];

        }

    }

});


router.post("/get-invoice-summary-data",function(req,res,next){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    var search_key = {};

    var nPage = 50;
    var page = 1;
    var numberOfDocs = 0;
    var numberOfDocstab1_3 = 0;



    var search_key_filter = {};
    var q_query = [];
    var and_query = [];


    var json2csv = require('json2csv');


    var Schema = mongoose.Schema;

    var fs = require('fs');

    var Grid = require('gridfs-stream');

    Grid.mongo = mongoose.mongo;


    var fields = [];
    var invoice = [];

    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");
    var timestamp = atz.toDate();

    var invoiceProcess = "";
    var endOfMonth = new Date(moment().endOf('month').format('YYYY-MM-DD 00:00:00'));

    if(req.body.tab)
    {
        if(req.body.tab == 1)
        {

            if(req.body.search)
            {

                search_key_filter = {"added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                },
                "status":"new"}


                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                                "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                            },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else
            {
                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"new"
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }

        }
        else if(req.body.tab == 2)
        {

            if(req.body.search)
            {
                if(req.body.isOrderDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isDueDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }

                else if(req.body.isLastUpdated)
                {



                    if(req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {

                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){

                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }

                }

                else if(req.body.isOrderDate&&req.body.isLastUpdated)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }
                }
                else if(req.body.isDueDate&&req.body.isLastUpdated)
                {

                    if(req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = { "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                                "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = { "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },

                        }
                    }
                }
                else
                {
                    if(req.body.status && req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }

                    else if(req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "status":req.body.status.toLowerCase()
                        }
                    }

                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];
                    }

                    and_query.push({$or:q_query});
                }

            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 3)
        {
            if(req.body.search)
            {

                search_key_filter = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    }
                }

                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }


                } else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }
            }
            else
            {
                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    }
                }
            }



            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 4)
        {

            if(req.body.search)
            {
                search_key_filter = {
                    "order_id": {'$regex' : '-00000001', '$options' : 'i'}
                }

                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                search_key_filter.order_id = {'$regex' : '-00000001', '$options' : 'i'};
                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else

            {
                search_key = {
                    "order_id": {'$regex' : '-00000001', '$options' : 'i'}
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 6)
        {

            if(req.body.search)
            {

                search_key_filter = {"added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                },
                    "status":"paid"
                }


                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else
            {
                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"paid"
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
    }
    else
    {
        var result = {success:false,err:"Missing tab parameter"};
        return res.status(200).send(result);
    }


    db.once('open', function () {


        var clients = [];
        var promises = [];

        function delay() {
            return Q.delay(100);
        }


        function getInvoiceData()
        {

            if(req.body.search)
            {


                invoiceProcess = Invoice.find().skip((page - 1) * nPage).limit(nPage).sort({added_on: -1});
                invoiceProcess.and(and_query);
                console.log(and_query);

            }
            else
            {


                invoiceProcess = Invoice.find(search_key).skip((page - 1) * nPage).limit(nPage).sort({added_on: -1});

            }

            invoiceProcess.exec(function (err, doc) {


                if (err) {
                    console.log(err);
                    db.close();
                    result = {success: false, error: err, msg: ""};
                    return res.status(200).send(result);
                }
                else {

                    for (var i = 0; i < doc.length; i++) {
                        item = doc[i];

                        var per_client_promises = [];

                        item.db = db;

                        var promise_client_settings = item.getClientInfo();
                        var promise_client_balance = item.getAvailableBalanceMongo();
                        var promise_ready_for_release_notes = item.getReadyForReleaseNotes();


                        per_client_promises.push(promise_client_settings);
                        per_client_promises.push(delay);

                        per_client_promises.push(promise_client_balance);
                        per_client_promises.push(delay);

                        per_client_promises.push(promise_ready_for_release_notes);
                        per_client_promises.push(delay);


                        per_client_promises_promise = Q.allSettled(per_client_promises);
                        promises.push(per_client_promises_promise);
                        promises.push(delay);

                    }

                    var allPromise = Q.allSettled(promises);
                    allPromise.then(function (results) {

                        console.log("All promises are done");

                        function promiseDone(i)
                        {
                            if(i < doc.length)
                            {
                                item = doc[i];

                                clients.push(item.getDataSummaryView(i));

                                promiseDone(i+1);

                            }
                            else
                            {
                                var result = {
                                    success: true,
                                    data_report: clients,
                                    total_report_data: doc.length
                                };
                                db.close();
                                return res.status(200).send(result);

                            }
                        }

                        promiseDone(0);
                    });

                }

            });
        }
        getInvoiceData();

    });

});


router.post("/export-tab2",function(req,res,next){


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    var search_key = {};

    var search_key_filter = {};
    var q_query = [];
    var and_query = [];


    var json2csv = require('json2csv');


    var Schema = mongoose.Schema;

    var fs = require('fs');

    var Grid = require('gridfs-stream');

    Grid.mongo = mongoose.mongo;


    var fields = [];
    var invoice = [];


    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");
    var timestamp = atz.toDate();

    var invoiceProcess = "";
    var invoiceCount = "";


    var numberofDocs = 0;
    var result = "";
    var error = "";

    var nPage = 200;
    var page = 1;

    var endOfMonth = new Date(moment().endOf('month').format('YYYY-MM-DD 00:00:00'));

    if(req.body.tab)
    {
        if(req.body.tab == 1)
        {

            fields = ["Client","Invoice_Number","Suspension_Days","Currency","Applied_Gst","Order_Date","Due_Date","Covered_Dates","Invoice_Amount",
                "Status","Available_Balance","Payment_Advice"];


            if(req.body.search)
            {
                search_key_filter = {"added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                },
                    "status":"new"
                }

                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"new"

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else
            {


                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"new"
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }

        }
        else if(req.body.tab == 2)
        {


            fields = ["Client","Invoice_Number","Suspension_Days","Currency","Invoice_Type","Covered_Dates",
                "Order_Date","Due_Date","Last_Date_Updated","Invoice_Amount",
                "Status","Available_Balance"];


            if(req.body.search)
            {
                if(req.body.isOrderDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isDueDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }

                else if(req.body.isLastUpdated)
                {



                    if(req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {

                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){

                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }

                }

                else if(req.body.isOrderDate&&req.body.isLastUpdated)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }
                }
                else if(req.body.isDueDate&&req.body.isLastUpdated)
                {

                    if(req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },

                        }
                    }
                }
                else
                {
                    if(req.body.status && req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }

                    else if(req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "status":req.body.status.toLowerCase()
                        }
                    }

                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];
                    }

                    and_query.push({$or:q_query});
                }

            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 3)
        {


            fields = ["Client", "Invoice_Number", "Suspension_Days", "Currency", "Covered_Dates",
                    "Order_Date", "Due_Date", "Date_Paid", "Invoice_Amount",
                    "Status", "Available_Balance", "Remarks"];


            if(req.body.search)
            {
                search_key_filter = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    }
                }

                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }


                } else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }
            }
            else
            {
                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    }
                }
            }



            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 4)
        {

            fields = ["Client", "Invoice_Number", "Suspension_Days", "Currency","Applied_GST",
                "Order_Date", "Due_Date","Covered_Dates","Invoice_Amount","Receipt_Number",
                "Status", "Available_Balance"];

            if(req.body.search)
            {
                search_key_filter = {
                    "order_id": {'$regex' : '-00000001', '$options' : 'i'}
                }

                if(req.body.isOrderDate)
                {


                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                search_key_filter.order_id = {'$regex' : '-00000001', '$options' : 'i'};
                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else

            {
                search_key = {
                    "order_id": {'$regex' : '-00000001', '$options' : 'i'}
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
        else if(req.body.tab == 6)
        {
            fields = ["Client","Invoice_Number","Suspension_Days","Currency","Applied_Gst","Order_Date","Due_Date","Covered_Dates","Invoice_Amount",
                "Status","Available_Balance","Payment_Advice"];


            if(req.body.search)
            {
                search_key_filter = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"paid"
                }

                if(req.body.isOrderDate)
                {

                    if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"
                        }
                    }



                }
                else if(req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"
                        }
                    }

                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },

                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":"paid"

                        }
                    }


                }else
                {
                    if(req.body.status)
                    {
                        search_key_filter = {"added_on": {
                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                            "status":req.body.status.toLowerCase()}
                    }
                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];




                    }

                    and_query.push({$or:q_query});
                }

            }
            else
            {


                search_key = {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"paid"
                }
            }

            if(req.body.page)
            {
                page = req.body.page;
            }
        }
    }
    else
    {
        var result = {success:false,err:"Missing tab parameter"};
        return res.status(200).send(result);
    }


    db.once('open', function () {




        function delay() {
            return Q.delay(100);
        }



        if(req.body.search)
        {
            invoiceCount = Invoice.find();
            invoiceCount.and(and_query);

        }
        else
        {
            invoiceCount = Invoice.count(search_key);


        }


        invoiceCount.exec(function(err,doc_count) {

            if(req.body.search)
            {
                numberofDocs = doc_count.length;
            }
            else
            {
                numberofDocs = doc_count;
            }


            console.log("Total number of documents" + " " + numberofDocs);
            function getDataperPage(x)
            {


                var clients = [];
                var promises = [];

                if(((x-1)*nPage) < numberofDocs)
                {
                    page = x;
                    console.log("Page: " + page + " of "+((x-1)*nPage));


                    if(req.body.search)
                    {


                        invoiceProcess = Invoice.find().skip((page - 1) * nPage).limit(nPage).sort({added_on: -1});
                        invoiceProcess.and(and_query);
                        //console.log(and_query);


                    }
                    else
                    {

                        invoiceProcess = Invoice.find(search_key).skip((page - 1) * nPage).limit(nPage).sort({added_on: -1});
                    }


                    invoiceProcess.exec(function(err,doc){

                        if (err) {
                            console.log(err);
                            db.close();
                            result = {success: false, error: err, msg: ""};
                            return res.status(200).send(result);
                        }
                        else {

                            for (var i = 0; i < doc.length; i++) {
                                item = doc[i];
                                if(item.client_id)
                                {
                                    var per_client_promises = [];

                                    item.db = db;

                                    var promise_client_settings = item.getClientInfo();
                                    var promise_client_balance = item.getAvailableBalanceMongo();


                                    per_client_promises.push(promise_client_settings);
                                    per_client_promises.push(delay);

                                    per_client_promises.push(promise_client_balance);
                                    per_client_promises.push(delay);


                                    per_client_promises_promise = Q.allSettled(per_client_promises);
                                    promises.push(per_client_promises_promise);
                                    promises.push(delay);
                                }
                            }
                        }

                        var allPromise = Q.allSettled(promises);
                        allPromise.then(function (results) {


                            console.log("All promises are done");

                            function promiseDone(i)
                            {
                                if(i < doc.length)
                                {
                                    item = doc[i];

                                    clients.push(item.getDataSummaryView(i));

                                    promiseDone(i+1);
                                }
                                else
                                {


                                    if(req.body.tab == 1 || req.body.tab == 6)
                                    {
                                        var exclude = req.body.exclude;
                                        if(exclude)
                                        {
                                            for (var x = 0; x < clients.length; x++) {
                                                item = clients[x];
                                                var cover_dates = "";

                                                if(item.items)
                                                {


                                                    if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                    {
                                                        cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                    }


                                                }



                                                if (item.days_before_suspension != -30) {
                                                    invoice.push({

                                                        Client: item.client_fname + " " + item.client_lname,
                                                        Invoice_Number: item.order_id,
                                                        Suspension_Days: item.days_before_suspension,
                                                        Currency: item.currency,
                                                        Applied_Gst: item.apply_gst,
                                                        Order_Date: formatDate(item.order_date),
                                                        Due_Date: formatDate(item.due_date),
                                                        Covered_Dates: cover_dates,
                                                        Invoice_Amount: item.total_amount,
                                                        Status: item.status,
                                                        Available_Balance: item.available_balance,
                                                        Payment_Advice: (item.payment_advice ? "Yes" : "No")

                                                    });
                                                }
                                            }
                                        }
                                        else
                                        {

                                            for (var x = 0; x < clients.length; x++) {
                                                item = clients[x];

                                                var cover_dates = "";

                                                if(item.items)
                                                {

                                                    if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                    {
                                                        cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                    }
                                                }
                                                invoice.push({

                                                    Client: item.client_fname + " " + item.client_lname,
                                                    Invoice_Number: item.order_id,
                                                    Suspension_Days: item.days_before_suspension,
                                                    Currency: item.currency,
                                                    Applied_Gst: item.apply_gst,
                                                    Order_Date: formatDate(item.order_date),
                                                    Due_Date: formatDate(item.due_date),
                                                    Covered_Dates: cover_dates,
                                                    Invoice_Amount: item.total_amount,
                                                    Status: item.status,
                                                    Available_Balance: item.available_balance,
                                                    Payment_Advice: (item.payment_advice ? "Yes" : "No")

                                                });
                                            }

                                        }

                                        page = page + 1;
                                        getDataperPage(page);

                                    }
                                    else if(req.body.tab == 2)
                                    {

                                        if(req.body.active)
                                        {
                                            for(var i = 0 ; i < clients.length ; i++) {
                                                item = clients[i];

                                                var inv_type = "";
                                                var cover_dates = "";
                                                var last_updated = "";
                                                if (item.active == "yes_client") {
                                                    if(item.items_all)
                                                    {
                                                        if (item.items_all.length > 0) {
                                                            for (var y = 0; y < item.items_all.length; y++) {
                                                                inv_t = item.items_all[y];

                                                                if (inv_t.item_type) {
                                                                    inv_type += inv_t.item_type + ", ";
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if(item.items)
                                                    {

                                                        if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                        {
                                                            cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                        }
                                                    }




                                                    invoice.push({

                                                        Client: item.client_fname + " " + item.client_lname,
                                                        Invoice_Number: item.order_id,
                                                        Suspension_Days: item.days_before_suspension,
                                                        Currency: item.currency,
                                                        Invoice_Type: inv_type,
                                                        Covered_Dates: cover_dates,
                                                        Order_Date: formatDate(item.order_date),
                                                        Due_Date: formatDate(item.due_date),
                                                        Last_Date_Updated: (item.last_date_update ? formatDate(item.last_date_update) : ""),
                                                        Invoice_Amount: item.total_amount,
                                                        Status: item.status,
                                                        Available_Balance: item.available_balance

                                                    });
                                                }
                                            }
                                            // page = page + 1;
                                            // getDataperPage(page);
                                        }
                                        else if(req.body.inactive)
                                        {
                                            for(var i = 0 ; i < clients.length ; i++) {
                                                item = clients[i];

                                                var inv_type = "";
                                                var cover_dates = "";
                                                if (item.active == "not_client") {

                                                    if(item.items_all)
                                                    {
                                                        if (item.items_all.length > 0) {
                                                            for (var y = 0; y < item.items_all.length; y++) {
                                                                inv_t = item.items_all[y];

                                                                if (inv_t.item_type) {
                                                                    inv_type += inv_t.item_type + ", ";
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if(item.items)
                                                    {

                                                        if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                        {
                                                            cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                        }
                                                    }



                                                    invoice.push({

                                                        Client: item.client_fname + " " + item.client_lname,
                                                        Invoice_Number: item.order_id,
                                                        Suspension_Days: item.days_before_suspension,
                                                        Currency: item.currency,
                                                        Invoice_Type: inv_type,
                                                        Covered_Dates: cover_dates,
                                                        Order_Date: formatDate(item.order_date),
                                                        Due_Date: formatDate(item.due_date),
                                                        Last_Date_Updated: (item.last_date_update ? formatDate(item.last_date_update) : ""),
                                                        Invoice_Amount: item.total_amount,
                                                        Status: item.status,
                                                        Available_Balance: item.available_balance

                                                    });
                                                }
                                            }
                                            // page = page + 1;
                                            // getDataperPage(page);
                                        }
                                        else
                                        {

                                            for(var i = 0 ; i < clients.length ; i++) {
                                                item = clients[i];
                                                var inv_type = "";
                                                var cover_dates = "";
                                                    if(item.items_all)
                                                    {
                                                        if (item.items_all.length > 0) {
                                                            for (var y = 0; y < item.items_all.length; y++) {
                                                                inv_t = item.items_all[y];

                                                                if (inv_t.item_type) {
                                                                    inv_type += inv_t.item_type + ", ";
                                                                }
                                                            }
                                                        }
                                                    }

                                                    if(item.items)
                                                    {

                                                        if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                        {
                                                            cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                        }
                                                    }
                                                    invoice.push({

                                                        Client: item.client_fname + " " + item.client_lname,
                                                        Invoice_Number: item.order_id,
                                                        Suspension_Days: item.days_before_suspension,
                                                        Currency: item.currency,
                                                        Invoice_Type: inv_type,
                                                        Covered_Dates: cover_dates,
                                                        Order_Date: formatDate(item.order_date),
                                                        Due_Date: formatDate(item.due_date),
                                                        Last_Date_Updated: (item.last_date_update ? formatDate(item.last_date_update) : ""),
                                                        Invoice_Amount: item.total_amount,
                                                        Status: item.status,
                                                        Available_Balance: item.available_balance

                                                    });
                                            }



                                        }
                                        // db.close();
                                        // return res.status(200).send(invoice);

                                        page = page + 1;
                                        getDataperPage(page);
                                    }
                                    else if(req.body.tab == 3)
                                    {
                                            for (var x = 0; x < clients.length; x++) {
                                                item = clients[x];
                                                remarks = "";
                                                var covered_date = "";
                                                if (item.history.length > 0) {
                                                    for (var a = 0; a < item.history.length; a++) {
                                                        remark = item.history[a];

                                                        if (remark.action == "remarks") {
                                                            remarks = "checked";
                                                        }

                                                    }
                                                }

                                                if (item.items) {

                                                    if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                    {
                                                        cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                    }
                                                }


                                                invoice.push({

                                                    Client: item.client_fname + " " + item.client_lname,
                                                    Invoice_Number: item.order_id,
                                                    Suspension_Days: item.days_before_suspension,
                                                    Currency: item.currency,
                                                    Covered_Dates: cover_dates,
                                                    Order_Date: formatDate(item.order_date),
                                                    Due_Date: formatDate(item.due_date),
                                                    Date_Paid: formatDate(item.date_paid),
                                                    Invoice_Amount: item.total_amount,
                                                    Status: item.status,
                                                    Available_Balance: item.available_balance,
                                                    Remarks: remarks

                                                });

                                            }

                                        page = page + 1;
                                        getDataperPage(page);

                                    }
                                    else if(req.body.tab == 4)
                                    {

                                        for (var x = 0; x < clients.length; x++) {
                                            item = clients[x];
                                            var cover_dates = "";

                                            if(item.items)
                                            {

                                                if(typeof item.items.start_date !== "undefined" && typeof item.items.end_date !== "undefined")
                                                {
                                                    cover_dates = formatDate(item.items.start_date) + " to " + formatDate(item.items.end_date);
                                                }
                                            }

                                                invoice.push({

                                                    Client: item.client_fname + " " + item.client_lname,
                                                    Invoice_Number: item.order_id,
                                                    Suspension_Days: item.days_before_suspension,
                                                    Currency: item.currency,
                                                    Applied_GST: item.apply_gst,
                                                    Order_Date: formatDate(item.order_date),
                                                    Due_Date: formatDate(item.due_date),
                                                    Covered_Dates: cover_dates,
                                                    Invoice_Amount: item.total_amount,
                                                    Receipt_Number:item.payment_receipt,
                                                    Status: item.status,
                                                    Available_Balance: item.available_balance

                                                });

                                        }

                                        page = page + 1;
                                        getDataperPage(page);

                                    }

                                }
                            }

                            promiseDone(0);

                        });

                    });

                }
                else
                {
                    var csv = json2csv({ data:invoice,fields:fields });


                    fs.writeFile(tmpPath+'tab'+req.body.tab+'_'+timestamp.getTime()+'.csv', csv, function(err) {
                        if (err){

                            console.log(err);
                            db.close();
                            var result = {success:false,grid_data:null};
                            return res.status(200).send(result);
                        }
                        else
                        {
                            console.log('open');
                            var gfs = Grid(db.db);

                            // streaming to gridfs
                            //filename to store in mongodb
                            var writestream = gfs.createWriteStream({
                                filename: 'tab'+req.body.tab+'_'+timestamp.getTime()+'.csv'
                            });
                            fs.createReadStream(tmpPath+'tab'+req.body.tab+'_'+timestamp.getTime()+'.csv').pipe(writestream);

                            writestream.on('close', function (file) {
                                // do something with `file`
                                console.log(file.filename + ' Written To DB');
                                db.close();
                                // res.download('./file.csv','test.csv');

                                var result = {success:true,grid_data:file};
                                return res.status(200).send(result);
                            });

                        }
                    });

                }

            }


            getDataperPage(1);


        });

    });


    function formatDate(unixtime) {

        if(!unixtime || typeof unixtime == 'undefined')
        {
            return "";
        }

        var d = new Date(unixtime);
        var n =  d.toDateString();
        var da = n.split(" ");
        return da[(da.length - (da.length -1))]+" "+da[(da.length - (da.length - 2))]+" "+da[(da.length-1)];
    }


});


router.post("/count-documents",function(req,res,next){


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    var search_key = {};

    var search_key_filter = {};
    var q_query = [];
    var and_query = [];


    var invoiceProcess = "";

    var tab = req.body.tab;
    var tab1_amount = null;
    var tab2_amount = null;
    var tab3_amount = null;
    var tab4_amount = null;
    var tab6_amount = null;

    var isMonthly = (typeof req.body.excludeBox !== 'undefined' ? req.body.excludeBox : true);

    var endOfMonth = new Date(moment().endOf('month').format('YYYY-MM-DD 00:00:00'));

    if(!req.body.search)
    {
        if(tab == 1)
        {
            search_key = {
                "added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                "status":"new"
            }
        }

        else if(tab == 3)
        {
            search_key = {
                "added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                }
            }
        }
        else if(tab == 6)
        {
            search_key = {
                "added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                },
                "status":"paid"
            }
        }
        else if(tab == 4)
        {
            search_key = {
                "order_id": {'$regex' : '-00000001', '$options' : 'i'}
            }
        }
    }
    else
    {
        if(tab == 1)
        {



            search_key_filter = {"added_on": {
                '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                 },
                "status":"new"
            }

            if(req.body.isOrderDate)
            {

                if(req.body.status)
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"new"
                    }
                }



            }
            else if(req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"new"
                    }
                }

            }
            else if(req.body.isOrderDate&&req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },

                        "status":req.body.status.toLowerCase()

                    }
                }
                else
                {
                    search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"new"

                    }
                }


            } else
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },
                        "status":req.body.status.toLowerCase()}
                }
            }


            and_query.push(search_key_filter);

            if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
            {
                var regs = req.body.searchBox.split(" ");

                if(regs.length > 1)
                {

                    for(var i = 0 ; i<regs.length ; i++ )
                    {
                        regs[i] = regs[i].trim().toLowerCase();
                    }


                    q_query = [
                        {"client_names" : {"$all":[regs]}}
                    ];

                    // q_query = [
                    //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                    // ];
                }
                else
                {
                    q_query = [
                        {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                    ];




                }

                and_query.push({$or:q_query});
            }
        }
        else if(tab == 2)
        {
            if(req.body.search)
            {
                if(req.body.isOrderDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "added_on": {
                                '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isDueDate)
                {
                    if(req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {
                        search_key_filter = {
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }

                }

                else if(req.body.isLastUpdated)
                {



                    if(req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }
                    else
                    {

                        search_key_filter = {
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }
                        }
                    }
                }
                else if(req.body.isOrderDate&&req.body.isDueDate)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){

                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "pay_before_date":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }

                }

                else if(req.body.isOrderDate&&req.body.isLastUpdated)
                {


                    if(req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = {"added_on":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            }

                        }
                    }
                }
                else if(req.body.isDueDate&&req.body.isLastUpdated)
                {

                    if(req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type

                        }
                    }
                    else if(req.body.status){
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else if(req.body.status&&req.body.type)
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()

                        }
                    }
                    else
                    {
                        search_key_filter = { "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                            "last_date_updated":
                            {
                                '$gte': new Date(moment_tz(req.body.start_date_last_updated).format("YYYY-MM-DD HH:mm:ss")),
                                '$lte': new Date(moment_tz(req.body.end_date_last_updated).format("YYYY-MM-DD HH:mm:ss"))
                            },

                        }
                    }
                }
                else
                {
                    if(req.body.status && req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type,
                            "status":req.body.status.toLowerCase()
                        }
                    }

                    else if(req.body.type)
                    {
                        search_key_filter = {
                            "items.item_type":req.body.type
                        }
                    }
                    else if(req.body.status){
                        search_key_filter = {
                            "status":req.body.status.toLowerCase()
                        }
                    }

                }

                and_query.push(search_key_filter);

                if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
                {
                    var regs = req.body.searchBox.split(" ");

                    if(regs.length > 1)
                    {

                        for(var i = 0 ; i<regs.length ; i++ )
                        {
                            regs[i] = regs[i].trim().toLowerCase();
                        }


                        q_query = [
                            {"client_names" : {"$all":[regs]}}
                        ];

                        // q_query = [
                        //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                        // ];
                    }
                    else
                    {
                        q_query = [
                            {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                            {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                        ];
                    }

                    and_query.push({$or:q_query});
                }

            }
        }
        else if(tab == 3)
        {

            search_key_filter = {
                "added_on": {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                }
            }

            if(req.body.isOrderDate)
            {


                if(req.body.status)
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        }
                    }
                }



            }
            else if(req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        }
                    }
                }

            }
            else if(req.body.isOrderDate&&req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },

                        "status":req.body.status.toLowerCase()

                    }
                }
                else
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        }

                    }
                }


            } else
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                        "status":req.body.status.toLowerCase()}
                }
            }

            and_query.push(search_key_filter);

            if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
            {
                var regs = req.body.searchBox.split(" ");

                if(regs.length > 1)
                {

                    for(var i = 0 ; i<regs.length ; i++ )
                    {
                        regs[i] = regs[i].trim().toLowerCase();
                    }


                    q_query = [
                        {"client_names" : {"$all":[regs]}}
                    ];

                    // q_query = [
                    //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                    // ];
                }
                else
                {
                    q_query = [
                        {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                    ];




                }

                and_query.push({$or:q_query});
            }

        }

        else if(tab == 4)
        {

            if(req.body.isOrderDate)
            {

                if(req.body.status)
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        }
                    }
                }

            }
            else if(req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        }
                    }
                }

            }
            else if(req.body.isOrderDate&&req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },

                        "status":req.body.status.toLowerCase()

                    }
                }
                else
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        }

                    }
                }


            } else
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                        "status":req.body.status.toLowerCase()}
                }
            }

            search_key_filter.order_id = {'$regex' : '-00000001', '$options' : 'i'};

            and_query.push(search_key_filter);

            if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
            {
                var regs = req.body.searchBox.split(" ");

                if(regs.length > 1)
                {

                    for(var i = 0 ; i<regs.length ; i++ )
                    {
                        regs[i] = regs[i].trim().toLowerCase();
                    }


                    q_query = [
                        {"client_names" : {"$all":[regs]}}
                    ];

                    // q_query = [
                    //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                    // ];
                }
                else
                {
                    q_query = [
                        {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                    ];




                }

                and_query.push({$or:q_query});
            }

        }

        else if(tab == 6)
        {
            search_key_filter = {"added_on": {
                '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
            },
                "status":"paid"
            }
            if(req.body.isOrderDate)
            {


                if(req.body.status)
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "added_on": {
                            '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"paid"
                    }
                }



            }
            else if(req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":req.body.status.toLowerCase()
                    }
                }
                else
                {
                    search_key_filter = {
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"paid"
                    }
                }

            }
            else if(req.body.isOrderDate&&req.body.isDueDate)
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },

                        "status":req.body.status.toLowerCase()

                    }
                }
                else
                {
                    search_key_filter = {"added_on":
                    {
                        '$gte': new Date(moment_tz(req.body.start_date_order_date).format("YYYY-MM-DD HH:mm:ss")),
                        '$lte': new Date(moment_tz(req.body.end_date_order_date).format("YYYY-MM-DD HH:mm:ss"))
                    },
                        "pay_before_date":
                        {
                            '$gte': new Date(moment_tz(req.body.start_date_due_date).format("YYYY-MM-DD HH:mm:ss")),
                            '$lte': new Date(moment_tz(req.body.end_date_due_date).format("YYYY-MM-DD HH:mm:ss"))
                        },
                        "status":"paid"

                    }
                }


            } else
            {
                if(req.body.status)
                {
                    search_key_filter = {"added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                        "status":req.body.status.toLowerCase()}
                }
            }

            and_query.push(search_key_filter);

            if(req.body.searchBox !== ""  && typeof req.body.searchBox !== "undefined")
            {
                var regs = req.body.searchBox.split(" ");

                if(regs.length > 1)
                {

                    for(var i = 0 ; i<regs.length ; i++ )
                    {
                        regs[i] = regs[i].trim().toLowerCase();
                    }


                    q_query = [
                        {"client_names" : {"$all":[regs]}}
                    ];

                    // q_query = [
                    //     {"client_names": new RegExp("^" + regs.join("|") + "$", "i")}
                    // ];
                }
                else
                {
                    q_query = [
                        {"client_fname": new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_lname":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"client_email":   new RegExp('^'+req.body.searchBox+'$', "i")},
                        {"order_id": {'$regex' : req.body.searchBox, '$options' : 'i'}}
                    ];




                }

                and_query.push({$or:q_query});
            }
        }

    }

    db.once('open', function() {

        if(!req.body.search) {


            Invoice.aggregate([
                {$match: {
                    "added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                    },
                    "status":"new"
                }},
                {
                    $group: {
                        _id: "$currency",
                        total_amount: {$sum: "$total_amount"}
                    }
                }], function (err, result) {
                    tab1_amount = result;
                        Invoice.aggregate([
                        {$match: {}},
                        {
                            $group: {
                                _id: "$currency",
                                total_amount: {$sum: "$total_amount"}
                            }
                        }],function (err, result2) {
                            tab2_amount = result2;
                                Invoice.aggregate([
                                    {$match: {
                                        "added_on": {
                                            '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                                            '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))}
                                    }},
                                    {
                                        $group: {
                                            _id: "$currency",
                                            total_amount: {$sum: "$total_amount"}
                                        }
                                    }], function (err, result3) {
                                        tab3_amount = result3;
                                            Invoice.aggregate([
                                                {$match: {"order_id": {'$regex': '-00000001', '$options': 'i'}}},
                                                {
                                                    $group: {
                                                        _id: "$currency",
                                                        total_amount: {$sum: "$total_amount"}
                                                    }
                                                }], function (err, result4) {
                                                tab4_amount = result4;
                                                    Invoice.aggregate([
                                                        {$match: {
                                                            "added_on": {
                                                                '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                                                                '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                                                            },
                                                            "status":"paid"
                                                        }},
                                                        {
                                                            $group: {
                                                                _id: "$currency",
                                                                total_amount: {$sum: "$total_amount"}
                                                            }
                                                        }], function (err, result5) {
                                                        tab6_amount = result5;
                                                        countDocu();
                                                    });

                                            });

                                    })
                        });

                });


            function countDocu()
            {


                if (!req.body.total) {

                    //get tab1 total count
                    Invoice.count({"added_on": {
                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                        },"status":"new"}, function (err, doc_count) {

                        if (err) {
                            db.close();
                            console.log(err);
                            return res.status(200).send({success: false});
                        }

                        //get tab 2 total count
                        Invoice.count({}, function (err2, doc_count2) {
                            if (err2) {
                                db.close();
                                console.log(err2);
                                return res.status(200).send({success: false});
                            }

                            //get tab 3 total count
                            Invoice.count({"added_on": {
                                '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                                '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                            }}, function (err3, doc_count3) {

                                if (err3) {
                                    db.close();
                                    console.log(err3);
                                    return res.status(200).send({success: false});
                                }

                                //for tab 4
                                Invoice.count({
                                    "order_id": {
                                        '$regex': '-00000001',
                                        '$options': 'i'
                                    }
                                }, function (err4, doc_count4) {
                                    if (err4) {
                                        db.close();
                                        console.log(err);
                                        return res.status(200).send({success: false});
                                    }

                                    //for tab 6 total count
                                    Invoice.count({"added_on": {
                                        '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                                        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))
                                    },"status":"paid"}, function (err6, doc_count6) {

                                        if (err6) {
                                            db.close();
                                            console.log(err);
                                            return res.status(200).send({success: false});
                                        }

                                        var result = {
                                            success: true,
                                            totalCountDoc: doc_count,
                                            totalCountDoc2: doc_count2,
                                            totalCountDoc3: doc_count3,
                                            totalCountDoc4: doc_count4,
                                            totalCountDoc6: doc_count6,
                                            tab1Amount: tab1_amount,
                                            tab2Amount: tab2_amount,
                                            tab3Amount: tab3_amount,
                                            tab4Amount: tab4_amount,
                                            tab6Amount: tab6_amount
                                        };
                                        db.close();
                                        return res.status(200).send(result);


                                    });

                                });

                            })

                        });

                    });


                }

             }
        }
        else
        {
            if(tab ==1)
            {

                    invoiceProcess = Invoice.find();

                    invoiceProcess.and(and_query);

                    console.log(and_query);

                    invoiceProcess.exec(function(err,doc){
                        console.log(doc);
                        var result = {
                            success: true,
                            totalCountDoc: doc.length,
                        };
                        db.close();
                        return res.status(200).send(result);

                    });


            }
            else if(tab == 2)
            {
                invoiceProcess = Invoice.find();

                invoiceProcess.and(and_query);

                console.log(and_query);

                invoiceProcess.exec(function(err,doc){

                    var result = {
                        success: true,
                        totalCountDoc: doc.length
                    };
                    db.close();
                    return res.status(200).send(result);

                });
            }
            else
            {
                invoiceProcess = Invoice.find();

                invoiceProcess.and(and_query);

                console.log(and_query);

                invoiceProcess.exec(function(err,doc){

                    var result = {
                        success: true,
                        totalCountDoc: doc.length
                    };
                    db.close();
                    return res.status(200).send(result);

                });
            }
        }



    });

});



router.post("/del-invoice-remarks",function(req,res,next){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var InvoiceRemarks = db.model("InvoiceRemarks", invoiceRemarksSchema);
    var Invoice = db.model("Invoice", invoiceSchema);

    var nano = configs.getCouchDb();
    var db_name = "client_docs";
    var couch_db = nano.use(db_name);

    if(!req.body.client_id)
    {
        result = {success: false, error:"No client_id"};
        return res.status(200).send(result);
    }

    if(!req.body.order_id)
    {
        result = {success: false, error:"No order_id"};
        return res.status(200).send(result);
    }


    var document = {

        order_id : req.body.order_id,
        remark_date : new Date(),
        remarked_by : req.body.client_id
    }

    db.once('open', function(){


        InvoiceRemarks.findOneAndRemove({order_id:document.order_id},function(err,remarks){

            if (err) {
                console.log(err);
                db.close();
                return res.status(200).send(err);
            }
            else
            {

                Invoice.findOne({order_id:document.order_id}, function(err, doc){
                    var today = moment_tz().tz("GMT");
                    var atz = today.clone().tz("Asia/Manila");
                    var timestamp = atz.toDate();


                    if (typeof doc.history != "undefined"){
                        var history = doc.history;
                    }else{
                        var history = new Array();
                    }

                    history.push({

                        "timestamp": timestamp,
                        "changes": "Removed remarks",
                        "by": document.remarked_by,
                        "order_id" : document.order_id,
                        "action":"remove-remarks"
                    });


                    doc.history = history;

                    doc.save(function(err, updated_doc) {

                        if (err) {
                            console.log(err);
                            db.close();
                            var result = {success: false, error: err ,msg:""};
                            return res.status(200).send(result);
                        }
                        else
                        {

                            //Update Couchdb
                            couch_db.get(req.body.couch_id, function(err, couch_doc) {
                                updaterev = couch_doc._rev;
                                couch_doc._rev = updaterev;


                                var today = moment_tz().tz("GMT");
                                var atz = today.clone().tz("Asia/Manila");
                                var timestamp = atz.toDate();

                                couch_doc.mongo_synced = true;
                                if (typeof couch_doc.history != "undefined"){
                                    var history = couch_doc.comments;
                                }else{
                                    var history = [];
                                }

                                history.push({
                                    date : timestamp,
                                    changes: "Removed remarks",
                                    by: document.remarked_by,
                                    order_id : document.order_id,
                                    action:"remove-remarks"
                                });

                                couch_doc.history = history;

                                couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
                                    if (err){
                                        console.log(err.error);
                                        db.close();
                                        var result = {success:false, error : err.error};
                                        return res.send(result, 200);
                                    }
                                    else
                                    {
                                        // console.log(couch_doc);
                                    }
                                });
                            });

                            db.close();
                            result = {success: true,couch:updated_doc};
                            return res.status(200).send(result);
                        }

                    });

                });
            }


        });

    });


});



router.post("/add-invoice-remarks",function(req,res,next){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var InvoiceRemarks = db.model("InvoiceRemarks", invoiceRemarksSchema);
    var Invoice = db.model("Invoice", invoiceSchema);


    var nano = configs.getCouchDb();
    var db_name = "client_docs";
    var couch_db = nano.use(db_name);

    if(!req.body.client_id)
    {
        result = {success: false, error:"No client_id"};
        return res.status(200).send(result);
    }

    if(!req.body.order_id)
    {
        result = {success: false, error:"No order_id"};
        return res.status(200).send(result);
    }


    var document = {

        order_id : req.body.order_id,
        remark_date : new Date(),
        remarked_by : req.body.client_id
    }


    db.once('open', function(){



        var remarks = new InvoiceRemarks(document);


        remarks.save(function(err){
            if (err) {
                return err;
            }
            else {

                Invoice.findOne({order_id:document.order_id}, function(err, doc){

                    var today = moment_tz().tz("GMT");
                    var atz = today.clone().tz("Asia/Manila");
                    var timestamp = atz.toDate();


                    if (typeof doc.history != "undefined"){
                        var history = doc.history;
                    }else{
                        var history = new Array();
                    }

                    history.push({

                        "timestamp": timestamp,
                        "changes": "Add remarks",
                        "by": document.remarked_by,
                        "order_id" : document.order_id,
                        "action":"remarks"
                    });


                    doc.history = history;

                    doc.save(function(err, updated_doc) {

                        if (err) {
                            console.log(err);
                            db.close();
                            var result = {success: false, error: err ,msg:""};
                            return res.status(200).send(result);
                        }
                        else
                        {

                            //Update Couchdb
                            couch_db.get(req.body.couch_id, function(err, couch_doc) {
                                updaterev = couch_doc._rev;
                                couch_doc._rev = updaterev;


                                //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
                                var today = moment_tz().tz("GMT");
                                var atz = today.clone().tz("Asia/Manila");
                                var timestamp = atz.toDate();

                                couch_doc.mongo_synced = true;
                                if (typeof couch_doc.history != "undefined"){
                                    var history = couch_doc.comments;
                                }else{
                                    var history = [];
                                }

                                history.push({
                                    date : timestamp,
                                    changes: "Add remarks",
                                    by: document.remarked_by,
                                    order_id : document.order_id,
                                    action:"remarks"
                                });


                                couch_doc.history = history;

                                couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
                                    if (err){
                                        console.log(err.error);
                                        db.close();
                                        var result = {success:false, error : err.error};
                                        return res.send(result, 200);
                                    }
                                    else
                                    {
                                        // console.log(couch_doc);
                                    }
                                });
                            });

                            db.close();
                            result = {success: true,couch:updated_doc};
                            return res.status(200).send(result);
                        }

                    });
                });
            }
        })

        // InvoiceRemarks.insert(document,function(err,records){
        //
        //     if(err)
        //     {
        //         db.close();
        //         result = {success: false, error:err};
        //         return res.status(200).send(result);
        //     }
        //     else
        //     {
        //         db.close();
        //         result = {success: true, data:records};
        //         return res.status(200).send(result);
        //     }
        // });
    });

});


router.get("/export-to-csv",function(req,res,next){


    var Schema = mongoose.Schema;

    var fs = require('fs');

    var Grid = require('gridfs-stream');

    Grid.mongo = mongoose.mongo;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    //
    //
    var json2csv = require('json2csv');
    // var fs = require('fs');
    // fields = ["Client","Invoice_Number","Suspension_Days","Currency","Applied_Gst","Order_Date","Due_Date","Total_Amount",
    //     "Status","Available_Balance","Payment_Advice"];
    var invoice = [];
    //
    //
    // if(req.body.export)
    // {
    //
    //     if(req.body.tab == 1)
    //     {
    //         for(var x = 0 ; x < req.body.invoice.length ; x++ )
    //         {
    //             item = req.body.invoice[x];
    //
    //             invoice.push({
    //
    //                 Client: item.client_fname + " "+ item.client_lname,
    //                 Invoice_Number: item.order_id,
    //                 Suspension_Days: item.days_before_suspension,
    //                 Currency : item.Currency,
    //                 Applied_Gst : item.apply_gst,
    //                 Order_Date : item.order_date,
    //                 Due_Date : item.due_date,
    //                 Total_Amount : item.status,
    //                 Available_Balance : item.available_balance,
    //                 Payment_Advice : item.payment_advice
    //
    //             });
    //
    //         }
    //
    //
    //         var csv = json2csv({ data:invoice,fields:fields });
    //
    //
    //         fs.writeFile('./file.csv', csv, function(err) {
    //             if (err){ throw err;}
    //             else
    //             {
    //                 console.log('saved');
    //                 db.close();
    //                 //res.download('./file.csv','test.csv');
    //                 var result = {
    //                     success: true
    //                 };
    //                 res.download('./file.csv','test.csv');
    //             }
    //         });
    //     }
    //
    // }



    var fields = ["order_id","client_fname","client_lname","client_name"];


    db.once('open', function(){


        Invoice.find({order_id:"12129-00000045"}).exec(function(err,doc){

            console.log(doc);

            for(var i = 0 ; i < doc.length ; i++)
            {
                item = doc[i];

                invoice.push({
                    order_id : item.order_id,
                    client_fname: item.client_fname,
                    client_lname : item.client_lname,
                    client_name : item.client_fname + " " + item.client_lname

                });
            }

            var csv = json2csv({ data:invoice,fields:fields });


            fs.writeFile('./file.csv', csv, function(err) {
                if (err){

                    console.log(err);
                    db.close();
                    var result = {success:false,grid_data:null};
                    return res.status(200).send(result);
                }
                else
                {
                    console.log('open');
                    var gfs = Grid(db.db);

                    // streaming to gridfs
                    //filename to store in mongodb
                    var writestream = gfs.createWriteStream({
                        filename: 'tab1.csv'
                    });
                    fs.createReadStream('./file.csv').pipe(writestream);

                    writestream.on('close', function (file) {
                        // do something with `file`
                        console.log(file.filename + 'Written To DB');
                        db.close();
                        // res.download('./file.csv','test.csv');

                        var result = {success:true,grid_data:file};
                        return res.status(200).send(result);
                    });

                    // console.log('saved');
                    // db.close();
                    // //res.download('./file.csv','test.csv');
                    // var result = {
                    //     success: true
                    // };
                    // res.download('./file.csv','test.csv');
                }
            });
        });



    });


});


router.get("/exports-by-id",function(req,res,next){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);

    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;
    var gfs = null;

    db.once('open', function() {
        gfs = Grid(db.db);

        gfs.findOne({_id: req.query.id}, function (err, file) {

            console.log(file);

            if (err) {
                db.close();
                return res.status(400).send(err);
            }
            else if (!file) {
                db.close();
                return res.status(404).send('Error on the database looking for the file.');
            }

            res.set('Content-Type', file.contentType);
            res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');

            var readstream = gfs.createReadStream({
                _id: req.params.ID,
                filename: file.filename
            });
            //
            readstream.on("error", function (err) {

                console.log(err);
                res.end();
                db.close();
            });
            readstream.pipe(res);
        });
    });

});

router.get("/test-client",function(req,res,next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var Client = db.model("Client", clientSchema);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var clientId = req.query.id;

    db.once('open', function () {
        var filter = {client_id: parseInt(clientId)};
        Client.findOne(filter).lean().exec(function (err, client_basic_info) {


            if (err) {
                willFulfillDeferred.reject(err);
                me.db.close();
            }

            delete Client.full_content;

            var basic_info = {
                fname: client_basic_info.client_doc.client_fname,
                lname: client_basic_info.client_doc.client_lname,
                email: client_basic_info.client_doc.client_email,
                company_name: client_basic_info.lead.company_name,
                company_address: client_basic_info.lead.company_address,
                officenumber: client_basic_info.lead.officenumber,
                mobile: client_basic_info.lead.mobile,
                supervisor_email: client_basic_info.lead.supervisor_email,
                acct_dept_email1: client_basic_info.lead.acct_dept_email1,
                acct_dept_email2: client_basic_info.lead.acct_dept_email2,
                sec_email: client_basic_info.lead.sec_email,
                days_before_suspension: client_basic_info.client_doc.days_before_suspension,
                isActive: client_basic_info.lead.active,
                lead_fname: client_basic_info.lead.fname,
                lead_lname: client_basic_info.lead.lname
            };

            // client_basic_info = basic_info;
            db.close();


            return res.status(200).send(basic_info);
            willFulfillDeferred.resolve(basic_info);

        });
    });
});



/**
 * Reports all invoices with diferrent statuses from mongo and couch
 */
router.get("/invoice-with-different-status-report",function(req,res,next) {
    var start_date = new Date(moment_tz().subtract(1, "h").format("YYYY-MM-DD HH:mm:ss"));
    var end_date = new Date(moment_tz().format("YYYY-MM-DD HH:mm:ss"));


    var subject = "Unsynced Invoices from " + moment().subtract(1, "h").format("YYYY-MM-DD HH:mm:ss") + " -" + moment().format("YYYY-MM-DD HH:mm:ss");

    var invoiceStatusDifferenceReportingSchema = require("../models/InvoiceStatusDiferrenceReporting");
    var MailboxComponent = require("../components/Mailbox");
    var mailbox_component = new MailboxComponent();

    var swig  = require('swig');

    if(req.query.start_date){
        //return res.status(200).send({success: false, error:"start_date is required!"});
        start_date = new Date(moment_tz(req.query.start_date + "T00:00:00Z").format("YYYY-MM-DD HH:mm:ss"));
    }

    if(req.query.end_date){
        //return res.status(200).send({success: false, error:"end_date is required!"});
        end_date = new Date(moment_tz(req.query.end_date + "T23:59:59Z").format("YYYY-MM-DD HH:mm:ss"));
        subject = "Unsynced Invoices from " + req.query.start_date + " 00:00:00" + " - " + req.query.end_date + " 23:59:59";
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var Invoice = db.model("Invoice", invoiceSchema);
    var InvoiceStatusDiferrenceReporting = db.model("InvoiceStatusDiferrenceReporting", invoiceStatusDifferenceReportingSchema);

    function getDifference(current_mongo_doc){
        var willDefer = Q.defer();
        var willFullfill = willDefer.promise;
        var nano = configs.getCouchDb();
        var client_docs_couch_db = nano.use("client_docs");

        if(!current_mongo_doc.couch_id){
            willDefer.resolve(null);
        }

        client_docs_couch_db.get(current_mongo_doc.couch_id, function(err, body){
            if(body){
                if(body.status != current_mongo_doc.status){
                    console.log("Saving Mongo synced false for:");
                    console.log(current_mongo_doc);
                    body.mongo_synced = false;
                    client_docs_couch_db.insert(body, function(err, bodySaved){

                        if(err){
                            console.log("error saving mongo_synced");
                            console.log(err);

                            willDefer.resolve(null);
                        }

                        console.log("Saved output");
                        var data_to_save = {

                            mongo_status: current_mongo_doc.status,
                            couch_status: body.status,
                            couch_id: current_mongo_doc.couch_id,
                            order_id: current_mongo_doc.order_id,
                            date_reported: configs.getDateToday()
                        };
                        InvoiceStatusDiferrenceReporting.create(data_to_save, function (err, saved_mongo) {
                            if (err){
                                console.log("error saving to mongo");
                                console.log(err);
                            }
                            console.log('saved to mongo');
                            // saved!
                            willDefer.resolve(saved_mongo);
                        })
                    });
                    // willDefer.resolve(current_mongo_doc);
                } else{
                    willDefer.resolve(null);
                }
            } else{
                willDefer.resolve(null);
            }


        });
        return willFullfill;
    }

    db.once('open', function () {
        //fetch Invoices by date
        console.log("start_date " + start_date);
        console.log("end_date " + end_date);
        Invoice.find({
            added_on:{
                $gte: start_date,
                $lte: end_date,
            }
        }).select({status:1, couch_id:1, order_id:1}).lean().exec(function(err, foundInvoices){
            if(err){
                console.log(err);
                return res.status(200).send({success: false, error: err});
            }
            if(foundInvoices){
                console.log(foundInvoices.length);
            }


            var all_promises = [];

            for(var i = 0;i < foundInvoices.length;i++){
                all_promises.push(getDifference(foundInvoices[i]));
            }



            var allPromiseResolved = Q.allSettled(all_promises);
            allPromiseResolved.then(function(results){

                var invoices_with_different_statuses = [];

                for(var i = 0;i < results.length;i++){
                    var result = results[i];
                    if(result.value){
                        invoices_with_different_statuses.push(result.value);
                    }
                }


                if(invoices_with_different_statuses.length > 0){
                    //send email

                    var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice_reporting/status_different.html');

                    var output = template({
                        report : invoices_with_different_statuses,
                        title: subject,
                        ///accounts_v2/#/invoice/details/10637-00000040
                        portal_url: configs.getPortalUrl()
                    });


                    var to = ["accounts@remotestaff.com.au"];
                    var bcc = ["devs@remotestaff.com.au"];
                    if(env.environment != "production"){
                        to = ["devs@remotestaff.com.au"];
                        bcc = [];
                    }
                    var mailbox_doc = {
                        bcc : bcc,
                        cc : [],
                        from : "noreply@remotestaff.com.au",
                        sender : null,
                        reply_to : null,
                        generated_by : "NODEJS/invoice-reporting//invoice-with-different-status-report",
                        html : output,
                        text : null,
                        to : to,
                        sent : false,
                        subject : subject
                    };

                    console.log("sending mail " + subject);
                    mailbox_component.send(mailbox_doc);
                }



                console.log("closing db");
                db.close();

                return res.status(200).send({success: true, result: invoices_with_different_statuses});
            });

        });
    });
});


/*
    Notes for ready for release invoices.(Add)
*/
router.post("/add-notes-ready-for-release",function(req,res,next){

   var fieldObject =(typeof req.body.object !== 'undefined' ? req.body.object : null);

    if(!fieldObject)
    {
        console.log("No parameters");
        return res.status(200).send({success:false,msg:"No parameters"});
    }


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var ReadyForReleaseNotes = db.model("Notes", readyForReleaseNoteSchema);

    try{

        db.once("open",function(){

           fieldObject.date =  new Date(moment_tz().format("YYYY-MM-DD HH:mm:ss"));
           var notes = new ReadyForReleaseNotes(fieldObject);

           notes.save(function(err,doc){

               var result = {};
               result.success = true;
               result.msg = "Insert Successful";
               if(err)
               {
                   console.log(err);
                   db.close();
                   result.success = false;
                   result.msg = "Insert failed";
               }
               else
               {
                   result.document = doc;
               }

               console.log(doc);

               db.close();
               return res.status(200).send(result);

           });

        });



    }catch(e)
    {
        console.log(e);
        return res.status(200).send({success:false});
    }




});

module.exports = router;