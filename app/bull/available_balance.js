
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var moment = require('moment');
var mongoCredentials = configs.getMongoCredentials();

var availableBalanceSchema = require("../models/AvailableBalance");
var invoiceSchema = require("../models/Invoice");
var leadInfoSchema = require("../mysql/Lead_Info");
var Subcontractors = require("../mysql/Subcontractors");
var ClientComponent = require("../components/Client");


var ucwords = require('locutus/php/strings/ucwords');

module.exports = {

    /**
     * Sync available Balance of a client from couchdb to mongo client_available_balance
     * @param job
     * @param done
     */
    processPerClient:function(job, done){
        if(!job.data.processClient){
            console.log("Client is required!");
            done();
        }

        var client_id = parseInt(job.data.processClient.id);
        if(!client_id && !isNaN(client_id)){
            console.log("client_id is invalid! client_id: " + client_id);
            done();
        }
        console.log("Processing Available Balance of Client " + client_id);



        var workerDoneDefer = Q.defer();
        var workerDonePromise = workerDoneDefer.promise;


        var nano = configs.getCouchDb();
        var client_docs_couch_db = nano.use("client_docs");

        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

        var Invoice = db.model("Invoice", invoiceSchema);
        var AvailableBalance = db.model("AvailableBalance", availableBalanceSchema);

        db.once('open', function () {

            //collect all promises for full_content
            var all_full_content_promises = [];

            //a variable to hold the basic info of a client fetched from mysql
            var leads_basic_info = null;
            var client_status = "inactive";
            var active_staff_count = 0;
            var available_balance = 0.00;
            var daily_rate = 0;
            var credit_low = null;
            var credit_text_full_content = null;
            var client_settings = null;
            var num_issued_invoices = 0;
            var issued_invoices = [];
            var issued_order_ids = [];
            var they_owe_us = 0;
            var they_owe_us_invoices = [];
            var full_content = [];

            //fetch client's basic info from mysql
            var fetch_leads_basic_info_promise = leadInfoSchema.fetchSingleClientsInfoWithAttributes(
                {id: client_id},
                ["lname", "fname", ["id", "leads_id"], "csro_id", "business_partner_id", "email"]
            );

            //add the fetching promise of client's info from mysql to all_full_content_promises
            all_full_content_promises.push(fetch_leads_basic_info_promise);


            //when fetching of client's info from mysql is done
            //leads_basic_info = fetched details
            fetch_leads_basic_info_promise.then(function(foundClient){
                leads_basic_info = foundClient.dataValues;

                if(leads_basic_info){
                    console.log("Indexing client # " + leads_basic_info.leads_id + " " + leads_basic_info.fname + " " + leads_basic_info.lname);
                }
            });


            //fetch available_balance from client_docs[client, running_balance]
            var fetch_available_balance_couch_defer = Q.defer();
            var fetch_available_balance_couch_promise = fetch_available_balance_couch_defer.promise;


            //fetch client's daily rate from mysq promise
            var fetch_client_daily_rate_defer = Q.defer();
            var fetch_client_daily_rate_promise = fetch_client_daily_rate_defer.promise;

            //Fetch client's active staff count to find out if client is active/inactive
            var fetch_client_staff_promise = Subcontractors.fetchActiveClientStaffCount(client_id);

            fetch_client_staff_promise.then(function(staffCount){
                active_staff_count = parseInt(staffCount);
                if(staffCount > 0){
                    console.log("Client is active");
                    client_status = "active";
                }


                var available_balance_view = client_docs_couch_db.view("client", "running_balance", { key: client_id }, function(err, body) {
                    if (!err) {
                        // body.rows.forEach(function(doc) {
                        //     console.log(doc.value);
                        // });
                        console.log("Client's available balance fetched");
                        try{
                            available_balance = body.rows[0]["value"];
                        } catch(error){
                            console.log("Error available_balance = body.rows[0]['value'];");
                            console.log(error);
                        }

                        fetch_available_balance_couch_defer.resolve(available_balance);
                    } else{
                        console.log("Error fetching from client_docs [client, running_balance]");
                        console.log(err);
                        fetch_available_balance_couch_defer.resolve(available_balance);
                    }

                    if(client_status == "active"){
                        //fetch client daily rate from mysql
                        var daily_rate_fetch_promise = Subcontractors.fetchClientDailyRate(client_id);

                        daily_rate_fetch_promise.then(function(clients_daily_rate){
                            daily_rate = clients_daily_rate;
                            console.log("Fetched Client's daily rate " + daily_rate);

                            //Filter credit_status
                            if( available_balance <= (5.0 * daily_rate) &&  available_balance >= (2.0 * daily_rate) ){
                                credit_low = 5;
                                credit_text_full_content = "5 days low";
                            }else if( available_balance <= (2.0 * daily_rate) &&  available_balance >= (0 * daily_rate) ){
                                credit_low = 2;
                                credit_text_full_content = "2 days low";
                            }else if( available_balance <= (0 * daily_rate) ){
                                credit_low = 0;
                                credit_text_full_content = "zero credit";
                            }else{
                                credit_low = null;
                            }

                            console.log("Credit Low: " + credit_low);

                            fetch_client_daily_rate_defer.resolve(daily_rate);
                        });


                    } else{
                        console.log("client is inactive");
                        fetch_client_daily_rate_defer.resolve(daily_rate);
                    }
                });

            });

            //add fetch_client_staff_promise to all_full_content_promises for full_content
            all_full_content_promises.push(fetch_client_staff_promise);

            all_full_content_promises.push(fetch_available_balance_couch_promise);
            all_full_content_promises.push(fetch_client_daily_rate_promise);



            //fetch client currency settings
            var client_component = new ClientComponent();
            var fetch_client_currency_settings_promise = client_component.getCouchClientSettings(client_id);



            fetch_client_currency_settings_promise.then(function(found_client_settings){
                if(found_client_settings){
                    client_settings = found_client_settings;
                }
            });

            all_full_content_promises.push(fetch_client_currency_settings_promise);



            //fetch num_issued_invoices
            var fetch_num_issued_invoices_defer = Q.defer();
            var fetch_num_issued_invoices_promise = fetch_num_issued_invoices_defer.promise;


            Invoice.find({client_id: parseInt(client_id)}).select(
                {
                    order_id: 1,
                    status: 1,
                    total_amount: 1
                }
            ).lean().exec(function (err, foundInvoices) {

                if(err){
                    console.log("Error fetching invoice");
                    console.log(err);
                    fetch_num_issued_invoices_defer.resolve(false);
                }

                if(foundInvoices){
                    for(var i = 0;i < foundInvoices.length;i++){
                        var current_invoice = foundInvoices[i];
                        issued_order_ids.push(current_invoice.order_id);

                        num_issued_invoices += 1;
                        if(current_invoice.status){
                            if(current_invoice.status == "new"){
                                they_owe_us = they_owe_us + parseFloat(current_invoice.total_amount);
                                they_owe_us_invoices.push(current_invoice.order_id);
                            }
                            issued_invoices.push({
                                order_id : current_invoice.order_id,
                                status : current_invoice.status
                            });
                        }

                    }

                }

                fetch_num_issued_invoices_defer.resolve(foundInvoices);
            });

            all_full_content_promises.push(fetch_num_issued_invoices_promise);




            var allFullContentPromise = Q.allSettled(all_full_content_promises);

            allFullContentPromise.then(function(results){
                //when all fetching is done for full_content
                try{

                    if(leads_basic_info){
                        full_content.push(leads_basic_info.leads_id + "");

                        //full_content.push(ucwords(leads_basic_info.fname));
                        full_content.push(leads_basic_info.fname.toLowerCase());


                        //full_content.push(ucwords(leads_basic_info.lname));
                        full_content.push(leads_basic_info.lname.toLowerCase());

                        full_content.push(leads_basic_info.email.toLowerCase());

                    }


                    full_content.push(client_status);

                    if(credit_text_full_content){
                        full_content.push(credit_text_full_content);
                    }

                    if(client_settings){
                        full_content.push(client_settings["currency_gst_apply"]);
                        full_content.push(client_settings["currency_code"]);
                        full_content.push(client_settings["days_before_suspension"]);

                        if(client_settings["days_before_suspension"] == -30){
                            full_content.push("old clients");
                        }

                    }

                    for(var i = 0;i < issued_order_ids.length;i++){
                        full_content.push(issued_order_ids[i]);
                    }


                    var data = {
                        client_id: client_id,
                        fname: ucwords(leads_basic_info.fname),
                        lname: ucwords(leads_basic_info.lname),
                        email: leads_basic_info.email,
                        total_active_subcons: active_staff_count,
                        apply_gst: client_settings.currency_gst_apply,
                        currency: client_settings.currency_code,
                        days_before_suspension: parseInt(client_settings.days_before_suspension),
                        available_balance: available_balance,
                        daily_rate: daily_rate,
                        credit_low: credit_low,
                        client_status: client_status,
                        business_partner_id: leads_basic_info.business_partner_id,
                        csro_id: leads_basic_info.csro_id,
                        date_synced: configs.getDateToday(),
                        they_owe_us: {
                            invoice_amount: they_owe_us,
                            invoice: they_owe_us_invoices,
                            num_invoice: they_owe_us_invoices.length
                        },
                        issued_invoices: issued_invoices,
                        total_issued_invoice: num_issued_invoices,
                        full_content: full_content
                    };


                    // console.log("Full Content");
                    // console.log(full_content);
                    //
                    // console.log("data to save");
                    // console.log(data);



                    console.log("Trying to store data");
                    var search_key = {
                        client_id : parseInt(client_id)
                    }
                    function updateAvailableBalance(data_to_save, callback){
                        AvailableBalance.update(search_key, {$set: data_to_save}, {upsert: true}, callback);
                    }

                    AvailableBalance.findOne(search_key).select({_id:1}).exec(function(err, foundDoc){
                        if (err) {
                            console.log("Error fetching available balance");
                            console.log(err);
                            db.close();
                            workerDoneDefer.resolve(false);
                            //return res.status(200).send({success: false, error: err});
                        }

                        if(foundDoc){
                            //update
                            try{
                                delete data._id;
                            } catch(major_error){
                                console.log("Error deleting _id");
                                console.log(major_error);
                            }
                            updateAvailableBalance(data, function(err){
                                if(err){
                                    console.log("error saving available balance");
                                    console.log(err);
                                    db.close();
                                    workerDoneDefer.resolve(false);
                                }

                                console.log("Successfully updated");
                                db.close();
                                workerDoneDefer.resolve(foundDoc);
                            });
                        } else{
                            //insert
                            foundDoc = new AvailableBalance(data);

                            foundDoc.save(function(err){
                                if (err){
                                    console.log("Error inserting to available balance");
                                    console.log(err);
                                    db.close();
                                    workerDoneDefer.resolve(null);
                                }
                                console.log("Successfully inserted");
                                db.close();
                                workerDoneDefer.resolve(foundDoc);
                            });
                        }

                    });
                } catch(major_error){
                    console.log("Error after finishing all promises");
                    console.log(major_error);
                    db.close();
                    done();
                }


                // workerDoneDefer.resolve(true);
            });

        });


        workerDonePromise.then(function(){
            console.log("Finished syncing Available Balance for client " + client_id);
            done();
        });

    }
}