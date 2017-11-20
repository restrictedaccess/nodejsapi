/**
 * Created by JMOQUENDO on 6/27/17.
 */

var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");

var moment = require('moment');
var moment_tz = require('moment-timezone');


var mongoCredentials = configs.getMongoCredentials();


var invoiceComponent = require("../components/Invoice");


//schema for invoice creation track
var invoiceCreationTrack = require("../models/InvoiceCreationTrack");
var njsUrl = "http://127.0.0.1:3000";
var request = require('request');



module.exports = {
    invoiceCreationQueue:function(job, done){
        console.log("Starting bull process...");
        var client_id = (typeof job.data.client_id != "undefined" ? job.data.client_id  : null);


        function delay(){ return Q.delay(100); }

        var process = [];

        var willFulfillDeferred = Q.defer();
        var willFulfill = willFulfillDeferred.promise;
        process.push(willFulfill);
        process.push(delay);
        var id = [];

        var items = [];
        var item_added = [];

        var itemId = 0;
        var willfulfillItemsDeferred = Q.defer();
        var willfulfillItems = willfulfillItemsDeferred.promise;
        items.push(willfulfillItems);
        items.push(delay);

        var invoice = null;
        try {
            invoice = new invoiceComponent();
            var month_year = invoice.ts_date;
            var month_year2 = invoice.currency_date;
            // var month_year = "2017-01-01";
            // var month_year2 = "2016-12-01";
            invoice.client.client_id = client_id;

            if(client_id)
            {
                console.log("Creating Invoice for client "+invoice.client.client_id);
                createNewInvoice();
            }
            else
            {
                console.log("no CLIENT_ID");
                done(null,{success:true});
            }
            //function to call for invoice creation
            function createNewInvoice(){
                client_id = invoice.client.client_id;

                getInvoiceItems();

                function getClientDetails()
                {
                    var callbackClient = function(response)
                    {
                        var str = '';
                        //another chunk of data has been recieved, so append it to `str`
                        response.on('data', function (chunk) {
                            str += chunk;
                        });

                        //the whole response has been recieved, so we just print it out here
                        response.on('end', function () {
                            var data = JSON.parse(str)
                            invoice.client = data.result;

                            invoice.getTaxInvoice().then(function(result){

                                if(result)
                                {
                                    var invoiceData = invoice.toJSON();

                                    function callBackInvoice(error, response, body)
                                        {
                                            if(body.success)
                                            {
                                                if (!error) {
                                                    var callbackSync = function(response)
                                                    {
                                                        var str = '';
                                                        response.on('data', function (chunk) {
                                                            str += chunk;
                                                        });
                                                        response.on('end', function () {
                                                            //invoice.send();
                                                            recordTrack({success:true,msg:"success",api:"/invoice/sync-daily-rates?order_id="+body.order_id});
                                                            console.log("Done creating invoice for client "+invoice.client.client_id);
                                                            done(null,{success:true});


                                                        });
                                                    };
                                                    http.get(njsUrl + "/invoice/sync-daily-rates?order_id=" + body.order_id,callbackSync);
                                                }
                                                else {
                                                    console.log('Error happened: '+ error);
                                                    done(null,{success:true});
                                                }
                                            }
                                            else
                                            {
                                                recordTrack({success:false,msg:body.errors.errmsg,api:"/invoice/sync-daily-rates?order_id="});
                                                console.log({success:false,msg:body.errors.errmsg});
                                                done(null,{success:true});
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


                                        request(options,callBackInvoice);
                                }
                                else
                                {
                                    done(null,{success:true});
                                }
                            });
                        });

                    };

                    http.get(njsUrl + '/invoice/get-client-invoices/?id='+client_id, callbackClient);

                }

                function getInvoiceItems()
                {

                    //get items for timesheet (-30 days group)
                    var callback = function(response) {
                        var str = '';

                        //another chunk of data has been recieved, so append it to `str`
                        response.on('data', function (chunk) {
                            str += chunk;
                        });

                        //the whole response has been recieved, so we just print it out here
                        response.on('end', function () {
                            var data = JSON.parse(str)

                            if(typeof data.result !== "undefined" && data.result.length > 0)
                            {
                                item_added.push(data.result);
                                var result_item = data.result;
                                var regularRosteredCount = 0;
                                function getItems(i)
                                {

                                    if(i <  result_item.length)
                                    {
                                        var item = result_item[i];
                                        var invoice_items = {};

                                        if(item.item_type == "Regular Rostered Hours"){regularRosteredCount = regularRosteredCount + 1;}

                                        itemId = i+1;
                                        invoice_items.item_id = itemId;
                                        invoice_items.description = item.description;
                                        invoice_items.item_type = item.item_type;
                                        invoice_items.qty = item.qty;
                                        invoice_items.unit_price = parseFloat(item.staff_hourly_rate.toFixed(2));
                                        invoice_items.selected_date = {
                                            startDate : new Date(moment_tz(item.start_date).format("YYYY-MM-DD HH:mm:ss")),
                                            endDate : new Date(moment_tz(item.end_date).format("YYYY-MM-DD HH:mm:ss"))
                                        };
                                        invoice_items.selected = true;
                                        invoice_items.subcontractors_id = item.subcontractors_id;
                                        invoice_items.current_rate = parseInt(item.current_rate);
                                        invoice_items.staff_name = item.staff_name;
                                        invoice_items.start_date = new Date(moment_tz(item.start_date).format("YYYY-MM-DD HH:mm:ss"));
                                        invoice_items.end_date = new Date(moment_tz(item.end_date).format("YYYY-MM-DD HH:mm:ss"));
                                        invoice_items.job_designation = (typeof item.job_designation !== 'undefined' ? item.job_designation : "" );
                                        invoice.invoice_item.push(invoice_items);
                                        getItems(i+1);
                                    }
                                    else {

                                        if(regularRosteredCount > 0 )
                                        {
                                            http.get(njsUrl + '/timesheet/currency-adjustments?client_id='+client_id+'&month_year='+month_year2, callback2);

                                        }
                                        else
                                        {
                                            recordTrack({success:false,msg:"No Regular Rostered items Found",api:'/timesheet/invoice-items?client_id='+client_id+'&month_year='+month_year,client_id:client_id});
                                            console.log({success:false,msg:"No Regular Rostered items Found"});
                                            done(null,{success:true});
                                        }

                                    }
                                }
                                getItems(0);

                            }
                            else {
                                recordTrack({success:false,msg:"No data Found",api:'/timesheet/invoice-items?client_id='+client_id+'&month_year='+month_year,client_id:client_id});
                                console.log({success:false,msg:"No data Found"});
                                done(null,{success:true});
                            }

                        });
                    };



                    var callback2 = function(response)
                    {
                        var str = '';

                        //another chunk of data has been recieved, so append it to `str`
                        response.on('data', function (chunk) {
                            str += chunk;
                        });

                        //the whole response has been recieved, so we just print it out here
                        response.on('end', function () {
                            var data = JSON.parse(str)

                            if(typeof data.result !== "undefined" && data.result.length > 0)
                            {
                                item_added.push(data.result);
                                invoice.hasCurrencyAdj = true;
                                var result_item = data.result;
                                function getItems(i)
                                {
                                    if(i <  result_item.length)
                                    {
                                        var item = result_item[i];
                                        var invoice_items = {};
                                        itemId = itemId +1;
                                        invoice_items.item_id = itemId;
                                        invoice_items.description = item.description;
                                        invoice_items.item_type = item.item_type;
                                        invoice_items.qty = item.qty;
                                        invoice_items.unit_price = parseFloat(item.currency_adjustment.toFixed(2));
                                        invoice_items.selected_date = {
                                            startDate : new Date(moment_tz(item.start_date).format("YYYY-MM-DD HH:mm:ss")),
                                            endDate : new Date(moment_tz(item.end_date).format("YYYY-MM-DD HH:mm:ss"))
                                        };
                                        invoice_items.selected = true;
                                        invoice_items.subcontractors_id = item.subcontractors_id;
                                        invoice_items.current_rate = parseInt(item.current_rate);
                                        invoice_items.staff_name = item.staff_name;
                                        invoice_items.start_date = new Date(moment_tz(item.start_date).format("YYYY-MM-DD HH:mm:ss"));
                                        invoice_items.end_date = new Date(moment_tz(item.end_date).format("YYYY-MM-DD HH:mm:ss"));
                                        invoice_items.job_designation = (typeof item.job_designation !== 'undefined' ? item.job_designation : "" );
                                        invoice.invoice_item.push(invoice_items);
                                        getItems(i+1);
                                    }

                                    else {

                                        console.log("Done adding items");

                                        getClientDetails();


                                    }
                                }
                                getItems(0);
                            }
                            else
                            {

                                getClientDetails();
                                console.log({msg:"No data Found2"});
                                // recordTrack({success:false,msg:"No data Found",api:'/timesheet/currency-adjustments?client_id='+client_id+'&month_year='+month_year2,client_id:client_id});
                                // console.log({success:false,msg:"No data Found2"});
                                // done(null,{success:true});
                            }

                        });

                    };



                    http.get(njsUrl + '/timesheet/invoice-items?client_id='+client_id+'&month_year='+month_year, callback);

                }



                //for tracking
                function recordTrack(msg)
                {
                    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
                    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);

                    var fname = "",lname="",email="";

                    if(typeof invoice.client.lead !== "undefined")
                    {
                        fname = (typeof invoice.client.lead.fname !== "undefined" ? invoice.client.lead.fname :"");
                        lname = (typeof invoice.client.lead.lname !== "undefined" ? invoice.client.lead.lname :"");
                        email = (typeof invoice.client.lead.email !== "undefined" ? invoice.client.lead.email :"");
                    }

                    var document = {
                        client_id : (typeof invoice.client.client_id !== "undefined" ? invoice.client.client_id : msg.client_id),
                        client_fname : fname,
                        client_lname : lname,
                        client_email : email,
                        client_names : [fname.toLowerCase(), lname.toLowerCase()],
                        order_id : (invoice.tax_invoice_no ? invoice.tax_invoice_no : ""),
                        invoice_date : month_year,
                        due_date : invoice.due_date,
                        date_created : configs.getDateToday(),
                        queue : "pending",
                        status:{
                            success:msg.success,
                            msg:msg.msg,
                            api:msg.api
                        },
                        currency: (typeof invoice.client.currency !== 'undefined' ? invoice.client.currency : ""),
                        total_amount: (invoice.getTotal()  ? parseFloat(invoice.getTotal()) : null)
                    }

                    var filter = {
                        client_id:parseInt(document.client_id),
                        date_created:{'$gte':new Date()}
                    };

                    db.once('open', function(){

                        try {

                            InvoiceCreation.findOneAndUpdate(filter,document,{upsert:true},function(err,doc){

                                if (err){
                                    console.log(err);
                                }
                                db.close();
                                console.log("Success adding track");

                            });
                        }catch(e)
                        {
                            db.close();
                            console.log("Error recording track");
                        }
                    });
                }
            }


        }catch (e)
        {
            console.log(e);
            done(null,{success:true});
        }
    }
}

