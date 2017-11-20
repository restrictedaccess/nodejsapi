
var express = require('express');
var configs = require("../../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');


var mongoCredentials = configs.getMongoCredentials();

var abs = require('locutus/php/math/abs');
var str_replace = require('locutus/php/strings/str_replace');


var functions_to_export = {
    processBatchInvoices: function(job, done){
        try{

            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);


            var xeroInvoicesToSyncSchema = require("../../models/XeroInvoicesToSync");
            var xeroInvoicesWithStatusToSyncSchema = require("../../models/XeroInvoicesWithStatusToSync");
            var xeroInvoiceSchema = require("../../models/XeroInvoice");
            var xeroInvoiceErrorsSchema = require("../../models/XeroInvoiceErrors");

            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

            var XeroInvoiceToSyncModel = db.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);
            var XeroInvoicesWithStatusToSyncModel = db.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);
            var XeroInvoicesModel = db.model("XeroInvoice", xeroInvoiceSchema);
            var XeroInvoiceErrorsModel = db.model("XeroInvoiceErrors", xeroInvoiceErrorsSchema);


            var xeroInvoiceErrorsObj = new XeroInvoiceErrorsModel();
            var xeroInvoiceObj = new XeroInvoicesModel();
            var xeroInvoicesToSyncObj = new XeroInvoiceToSyncModel();
            var xeroInvoicesWithStatusToSyncObj = new XeroInvoicesWithStatusToSyncModel();


            db.once("open", function(){
                console.log("Fetching all invoices to sync");
            });

            var batchCollectionToUse = xeroInvoicesToSyncObj;

            if(job.data.sync_with_status){
                batchCollectionToUse = xeroInvoicesWithStatusToSyncObj
            }


            batchCollectionToUse.getAllData(true).then(function(batch_invoices){
                batchCollectionToUse.cleareAllData();

                var invoices = [];

                for(var i = 0;i < batch_invoices.length;i++){

                    var current_invoice = batch_invoices[i];

                    try{
                        delete current_invoice["_id"];
                        delete current_invoice["__v"];
                    } catch(deleting_error){
                        console.log(deleting_error);
                    }

                    console.log(current_invoice);

                    invoices.push(xeroClient.core.invoices.newInvoice(current_invoice));

                }

                if(invoices.length > 0){

                    xeroClient.core.invoices.saveInvoices(invoices, {method: "post"})
                        .then(function(created_invoices) {
                            console.log("Invoices have been created");

                            var allSavingMongoPromises = [];

                            function saveToMongo(saved_invoice_data){
                                var defer = Q.defer();
                                var promise = defer.promise;

                                var current_invoice_to_mongo = saved_invoice_data.toJSON();

                                xeroInvoiceObj.saveData(current_invoice_to_mongo).then(function(saving_result){
                                    defer.resolve(saving_result);
                                });

                                return promise;
                            }

                            for(var i = 0;i < created_invoices.entities.length;i++){
                                allSavingMongoPromises.push(saveToMongo(created_invoices.entities[i]));
                            }

                            Q.allSettled(allSavingMongoPromises).then(function(results){
                                done(null, results);
                            });


                        })
                        .catch(function(err) {
                            //Some error occurred

                            console.log(err.toString());
                            var data_to_save = {
                                InvoiceNumber: "batch_saving_error",
                                ErrorMessage: err.toString(),
                                DateCreated: configs.getDateToday()
                            };


                            xeroInvoiceErrorsObj.saveData(data_to_save).then(function(saving_result){
                                done(err, null);
                            });
                        });

                } else{
                    console.log("No invoices to sync");
                    done(null, {success:true, result: "No Invoices to sync"});
                }


            });





        } catch(ultimate_error){
            console.log(ultimate_error);
        }
    },
    processPerInvoice: function (job, done) {
        try{

            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);

            if(!job.data.processInvoice){

                done("processInvoice field is required!", null);
            }

            var invoice = job.data.processInvoice;


            if(!invoice.order_id || invoice.order_id == ""){
                console.log(invoice);
                console.log("invoice.order_id must be valid");
                done(["invoice.order_id must be valid"], null);
                return true;
            }

            var order_id = invoice.order_id;

            var save_batch = false;
            if(job.data.isBatch){
                save_batch = job.data.isBatch;
            }

            console.log("Processing per invoice " + order_id);


            //fetch from client_settings mongo
            var invoiceSchema = require("../../models/Invoice");
            var clientSchema = require("../../models/Client");
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var InvoiceModel = db.model("Invoice", invoiceSchema);
            var ClientSettingsModel = db.model("Client", clientSchema);


            var xeroContactSchema = require("../../models/XeroContact");
            var xeroInvoiceSchema = require("../../models/XeroInvoice");
            var xeroInvoicesToSyncSchema = require("../../models/XeroInvoicesToSync");
            var xeroInvoicesWithStatusToSyncSchema = require("../../models/XeroInvoicesWithStatusToSync");
            var xeroCreditNoteSchema = require("../../models/XeroCreditNote");
            var xeroInvoiceErrorsSchema = require("../../models/XeroInvoiceErrors");
            var xerocreditNotesErrorsSchema = require("../../models/XeroCreditNotesErrors");

            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

            var XeroContactModel = db_xero.model("XeroContact", xeroContactSchema);
            var XeroInvoiceModel = db_xero.model("XeroInvoice", xeroInvoiceSchema);
            var XeroInvoicesToSyncModel = db_xero.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);
            var XeroInvoicesWithStatusToSyncModel = db_xero.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);
            var XeroCreditNoteModel = db_xero.model("XeroCreditNote", xeroCreditNoteSchema);
            var XeroInvoiceErrorsModel = db_xero.model("XeroInvoiceErrors", xeroInvoiceErrorsSchema);
            var XeroCreditNotesErrorsModel = db_xero.model("XeroCreditNotesErrors", xerocreditNotesErrorsSchema);

            var xeroContactObj = new XeroContactModel();
            var xeroInvoiceErrorsObj = new XeroInvoiceErrorsModel();
            var xeroInvoiceObj = new XeroInvoiceModel();
            var xeroInvoicesToSyncObj = new XeroInvoicesToSyncModel();
            var xeroInvoicesWithStatusToSyncObj = new XeroInvoicesWithStatusToSyncModel();
            var xeroCreditNoteObj = new XeroCreditNoteModel();
            var xeroCreditNotesErrorObj = new XeroCreditNotesErrorsModel();

            db_xero.once("open", function(){
                db_xero.close();
            });



            db.once("open", function(){

                InvoiceModel.findOne({order_id:order_id}).lean().exec(function(err, foundInvoice){

                    if(err){
                        db.close();
                        console.log(err);
                        done(err, null);
                    }
                    if(foundInvoice){

                        try{

                            var fetchMongoXeroDefer = Q.defer();
                            var mongoXeroPromise = fetchMongoXeroDefer.promise;

                            if(foundInvoice.total_amount >= 0){

                                xeroInvoiceObj.getOneData(order_id, true, {_id: 0}).then(function(foundXeroInvoice){
                                    fetchMongoXeroDefer.resolve(foundXeroInvoice);
                                });
                            } else{

                                xeroInvoiceObj.getOneData(order_id, true, {_id: 0}).then(function(foundXeroCreditNote){
                                    fetchMongoXeroDefer.resolve(foundXeroCreditNote);
                                });
                            }


                            mongoXeroPromise.then(function(foundXeroInvoice){


                                var XeroComponent = require("../../components/Xero");

                                XeroComponent.fetchContact(parseInt(foundInvoice.client_id)).then(function(foundContact){

                                    if(foundContact){

                                        console.log("Contact fetched " + foundContact.ContactID);

                                        console.log("Fetching client_settings");

                                        ClientSettingsModel.findOne({client_id: parseInt(foundInvoice.client_id)}).lean().select({apply_gst: true,currency: true}).exec(function(err, foundClientSettings){


                                            if(err) {
                                                db.close();
                                                console.log(err);
                                                done(err, null);
                                            }
                                            console.log("Fetched Client Settings of " + foundInvoice.client_id);

                                            var Type = "ACCREC";
                                            var Status = "AUTHORISED";
                                            var DueDate = moment(foundInvoice.pay_before_date).format("YYYY-MM-DD");
                                            var LineAmountTypes = "Exclusive";
                                            var LineItems = [];
                                            var TaxAmount = 0;

                                            function getLineItem(item, current_invoice){
                                                try{
                                                    if(item.unit_price == 0){
                                                        return null;
                                                    }
                                                    item.unit_price = item.unit_price.toFixed(2);

                                                } catch(error){
                                                    console.log(error);
                                                    return null;
                                                }

                                                var TaxType = "OUTPUT";
                                                var AccountCode = "RRH";
                                                var Description = item.description;

                                                if(typeof current_invoice.overpayment_from_doc_id != "undefined"){
                                                    AccountCode = "200";
                                                }

                                                if(typeof item.commission_id != "undefined"){
                                                    if(item.commission_id){
                                                        AccountCode = "COMM";
                                                        if(item.qty <= 0){
                                                            item.qty = abs(item.qty);
                                                            //item.unit_price = -1 * item.unit_price;
                                                        }
                                                        TaxType = "";
                                                    }
                                                }

                                                if(item.description.search("Adjustment Credit Memo") !== -1){
                                                    TaxType = "INPUT";
                                                    if(item.qty <= 0){
                                                        AccountCode = "ADJ CRM";
                                                        item.qty = abs(item.qty);
                                                        //item.unit_price = -1 * item.unit_price;
                                                    }
                                                }


                                                if(item.description.search("Currency Adjustment") !== -1){

                                                    if(item.qty <= 0){
                                                        AccountCode = "CUR GAIN";
                                                        item.qty = abs(item.qty);
                                                        //item.unit_price = -1 * item.unit_price;
                                                    } else{
                                                        AccountCode = "CUR LOS";
                                                    }
                                                    TaxType = "";

                                                }


                                                if(foundClientSettings.apply_gst == "Y"){

                                                    var current_line_amount = item.qty * item.unit_price;
                                                    current_line_amount = current_line_amount.toFixed(2);

                                                    var tax_amount = (current_line_amount) * .10;
                                                    TaxAmount = tax_amount.toFixed(2);
                                                    TaxAmount = parseFloat(TaxAmount);
                                                }

                                                if(item.qty < 0){
                                                    item.qty = abs(item.qty);
                                                    //item.unit_price = -1 * item.unit_price;
                                                }


                                                //get description

                                                var date_coverage = "";

                                                if (item.start_date && item.end_date){
                                                    date_coverage = "\n\nDate Coverage: [" + moment(item.start_date).format("YY MMM DD") + " to "+moment(item.end_date).format("YY MMM DD")+"]";
                                                }
                                                Description = str_replace("&", "&amp;", item.description);

                                                var lineItem = {
                                                    TaxType: TaxType,
                                                    UnitAmount: parseFloat(item.unit_price),
                                                    Quantity: parseFloat(item.qty),
                                                    AccountCode: AccountCode,
                                                    Description: Description + " " + date_coverage,
                                                    TaxAmount: TaxAmount
                                                };




                                                return lineItem;

                                            }

                                            for(var i = 0;i < foundInvoice.items.length;i++){
                                                var current_item = foundInvoice.items[i];
                                                var current_line_item = getLineItem(current_item, foundInvoice);
                                                if(current_line_item != null){
                                                    LineItems.push(current_line_item);
                                                }
                                            }

                                            // if(foundInvoice.status == "paid"){
                                            //     Type = "ACCRECPAYMENT";
                                            // }

                                            if(typeof foundInvoice.overpayment_from_doc_id != "undefined"){
                                                Status = "AUTHORISED";
                                                DueDate = moment(foundInvoice.added_on).format("YYYY-MM-DD");
                                            }

                                            if(foundClientSettings.apply_gst == "N"){
                                                LineAmountTypes = "NoTax";
                                            }


                                            if(foundInvoice.status == "cancelled"){
                                                Status = "VOIDED";
                                            }

                                            if(job.data.sync_without_status){
                                                Status = "AUTHORISED";
                                            }

                                            var data_to_sync = {
                                                Contact: {
                                                    ContactID: foundContact.ContactID
                                                },
                                                Type: Type,
                                                Status: Status,
                                                DueDate: DueDate,
                                                LineAmountTypes: LineAmountTypes,
                                                CurrencyCode: foundInvoice.currency,
                                                Date: moment(foundInvoice.added_on).format("YYYY-MM-DD"),
                                                LineItems: LineItems
                                            };


                                            console.log(data_to_sync);

                                            var invoiceObj = null;
                                            if(foundInvoice.total_amount >= 0){


                                                if(foundXeroInvoice){
                                                    //update xero
                                                    data_to_sync.InvoiceID = foundXeroInvoice.InvoiceID;
                                                }
                                                data_to_sync.InvoiceNumber = order_id;

                                                if(!save_batch){

                                                    invoiceObj = xeroClient.core.invoices.newInvoice(data_to_sync);


                                                    var saving_obj = invoiceObj.save();

                                                    saving_obj.then(function(invoices) {
                                                        //Contact has been created
                                                        console.log("invoice created in xero");

                                                        var current_invoice = invoices.entities[0].toJSON();
                                                        console.log(current_invoice);

                                                        xeroInvoiceObj.saveData(current_invoice).then(function(saving_result){
                                                            db.close();
                                                            done(null, {success: true, result:current_invoice});
                                                        });

                                                    }).catch(function(err) {
                                                        //Some error occurred
                                                        //save error
                                                        console.log(err.toString());
                                                        var data_to_save = {
                                                            InvoiceNumber: order_id,
                                                            ErrorMessage: err.toString(),
                                                            DateCreated: configs.getDateToday()
                                                        };


                                                        xeroInvoiceErrorsObj.saveData(data_to_save).then(function(saving_result){
                                                            db.close();
                                                            done(err, null);
                                                        });


                                                    });
                                                } else{
                                                    if(Status == "VOIDED"){
                                                        xeroInvoicesWithStatusToSyncObj.saveData(data_to_sync).then(function(saving_result){
                                                            db.close();
                                                            done(null, {success: true, result:data_to_sync, isBatch: save_batch});
                                                        });
                                                    } else{

                                                        xeroInvoicesToSyncObj.saveData(data_to_sync).then(function(saving_result){
                                                            db.close();
                                                            done(null, {success: true, result:data_to_sync, isBatch: save_batch});
                                                        });
                                                    }


                                                }


                                            } else{
                                                //credit note
                                                if(foundXeroInvoice){
                                                    //update xero
                                                    data_to_sync.CreditNoteID = foundXeroInvoice.CreditNoteID;
                                                }
                                                data_to_sync.Type = "ACCPAYCREDIT";
                                                data_to_sync.CreditNoteNumber = order_id;
                                                invoiceObj = xeroClient.core.creditNotes.newCreditNote(data_to_sync);


                                                var saving_obj = invoiceObj.save();

                                                saving_obj.then(function(credit_note) {
                                                    //Contact has been created
                                                    console.log("credit note created in xero");

                                                    var current_credit_note = credit_note.entities[0].toJSON();
                                                    console.log(current_credit_note);

                                                    xeroCreditNoteObj.saveData(current_credit_note).then(function(saving_result){
                                                        db.close();
                                                        done(null, {success: true, result:current_credit_note});
                                                    });

                                                }).catch(function(err) {
                                                    //Some error occurred
                                                    //save error
                                                    console.log(err.toString());
                                                    var data_to_save = {
                                                        CreditNoteNumber: order_id,
                                                        ErrorMessage: err.toString(),
                                                        DateCreated: configs.getDateToday()
                                                    };


                                                    xeroCreditNotesErrorObj.saveData(data_to_save).then(function(saving_result){
                                                        db.close();
                                                        done(err, null);
                                                    });


                                                });
                                            }


                                        });
                                    } else{
                                        db.close();
                                        console.log("Contact Not Found!");
                                        done();
                                    }


                                });

                            });


                        } catch(major_error){
                            db.close();
                            console.log(major_error);
                            done(major_error, null);
                        }


                    } else{
                        db.close();
                        done(["Order ID does not exists"], null);
                    }
                });


            });

        } catch(error){
            console.log(error);
        }

    },
    processBatchPayments: function(job, done){
        try{

            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);


            var xeroPaymentsToSyncSchema = require("../../models/XeroPaymentsToSync");
            var xeroPaymentschema = require("../../models/XeroPayments");
            var xeroPaymentsErrorsSchema = require("../../models/XeroPaymentErrors");

            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

            var XeroPaymentsToSyncModel = db.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);
            var XeroPaymentsModel = db.model("XeroPayments", xeroPaymentschema);
            var XeroPaymentErrorsModel = db.model("XeroPaymentErrors", xeroPaymentsErrorsSchema);



            var xeroPaymentsToSyncObj = new XeroPaymentsToSyncModel();
            var xeroPaymentsObj = new XeroPaymentsModel();
            var xeroPaymentsErrorsObj = new XeroPaymentErrorsModel();


            db.once("open", function(){
                console.log("Fetching all payments to sync");
            });


            xeroPaymentsToSyncObj.getAllData(true).then(function(batch_payments){
                xeroPaymentsToSyncObj.cleareAllData();

                var payments = [];

                for(var i = 0;i < batch_payments.length;i++){

                    var current_payment = batch_payments[i];

                    try{
                        delete current_payment["_id"];
                        delete current_payment["__v"];
                    } catch(deleting_error){
                        console.log(deleting_error);
                    }

                    console.log(current_payment);

                    payments.push(xeroClient.core.payments.newPayment(current_payment));

                }

                if(payments.length > 0){

                    xeroClient.core.payments.savePayments(payments, {method: "post"})
                        .then(function(created_payments) {
                            console.log("Payments have been created");

                            var allSavingMongoPromises = [];

                            function saveToMongo(saved_payment_data){
                                var defer = Q.defer();
                                var promise = defer.promise;

                                var current_payment_to_mongo = saved_payment_data.toJSON();

                                xeroPaymentsObj.saveData(current_payment_to_mongo).then(function(saving_result){
                                    defer.resolve(saving_result);
                                });

                                return promise;
                            }

                            for(var i = 0;i < created_payments.entities.length;i++){
                                allSavingMongoPromises.push(saveToMongo(created_payments.entities[i]));
                            }

                            Q.allSettled(allSavingMongoPromises).then(function(results){
                                done(null, results);
                            });


                        })
                        .catch(function(err) {
                            //Some error occurred

                            console.log(err.toString());
                            var data_to_save = {
                                InvoiceNumber: "batch_saving_error",
                                ErrorMessage: err.toString(),
                                DateCreated: configs.getDateToday()
                            };


                            xeroPaymentsErrorsObj.saveData(data_to_save).then(function(saving_result){
                                done(err, null);
                            });
                        });

                } else{
                    console.log("No payments to sync");
                    done(null, {success:true, result: "No Payments to sync"});
                }


            });





        } catch(ultimate_error){
            console.log(ultimate_error);
        }
    },
    processPerPaidInvoice: function(job, done){
        try{

            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);
            if(!job.data.processInvoice){
                console.log("processInvoice field is required!");
                done("processInvoice field is required!", null);
            }

            var invoice = job.data.processInvoice;


            //if batch
            var save_batch = false;
            if(typeof job.data.isBatch != "undefined"){
                console.log("batch saving");
                save_batch = job.data.isBatch;
            }


            if(!invoice.order_id || invoice.order_id == ""){
                console.log(invoice);
                console.log("invoice.order_id must be valid");
                done(["invoice.order_id must be valid"], null);
                return true;
            }

            var order_id = invoice.order_id;

            console.log("Processing per paid invoice " + order_id);


            //fetch from client_settings mongo
            var invoiceSchema = require("../../models/Invoice");
            var clientSchema = require("../../models/Client");
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var InvoiceModel = db.model("Invoice", invoiceSchema);
            var ClientSettingsModel = db.model("Client", clientSchema);


            var xeroContactSchema = require("../../models/XeroContact");
            var xeroInvoiceSchema = require("../../models/XeroInvoice");
            var xeroPaymentsSchema = require("../../models/XeroPayments");
            var xeroPaymentsToSyncSchema = require("../../models/XeroPaymentsToSync");
            var xeroPaymentErrorsSchema = require("../../models/XeroPaymentErrors");

            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

            var XeroContactModel = db_xero.model("XeroContact", xeroContactSchema);
            var XeroInvoiceModel = db_xero.model("XeroInvoice", xeroInvoiceSchema);
            var XeroPaymentsModel = db_xero.model("XeroPayments", xeroPaymentsSchema);
            var XeroPaymentsToSyncModel = db_xero.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);
            var XeroPaymentErrorsModel = db_xero.model("XeroPaymentErrors", xeroPaymentErrorsSchema);

            var xeroContactObj = new XeroContactModel();
            var xeroPaymentErrorsObj = new XeroPaymentErrorsModel();
            var xeroInvoiceObj = new XeroInvoiceModel();
            var xeroPaymentsObj = new XeroPaymentsModel();
            var xeroPaymentsToSyncObj = new XeroPaymentsToSyncModel();

            db_xero.once("open", function(){
                db_xero.close();
            });



            db.once("open", function(){

                InvoiceModel.findOne({order_id:order_id}).lean().exec(function(err, foundInvoice){

                    if(err){
                        db.close();
                        console.log(err);
                        done(err, null);
                    }
                    if(foundInvoice){

                        try{
                            xeroInvoiceObj.getOneData(order_id, true, {_id: 0}).then(function(foundXeroInvoice){


                                function syncXeroPayment(foundXeroInvoice){

                                    xeroPaymentsObj.getOneData(order_id, true, {PaymentID: 1}).then(function(foundXeroPayment){

                                        var XeroComponent = require("../../components/Xero");

                                        //if date paid is existing use date paid
                                        var date_paid = moment().format("YYYY-MM-DD");
                                        var AccountID = configs.getNABAccountXero();
                                        var Total = foundXeroInvoice.Total;

                                        if(typeof foundInvoice.payment_mode != "undefined"){
                                            if(foundInvoice.payment_mode == "paypal"){
                                                AccountID = configs.getPAYPALAccountXero();
                                            }
                                        }


                                        if(typeof foundInvoice.date_paid != "undefined"){
                                            date_paid = moment.utc(foundInvoice.date_paid).format("YYYY-MM-DD");
                                        }



                                        var data_to_sync = {
                                            Date: date_paid,
                                            Account:{
                                                AccountID: AccountID,
                                            },
                                            Invoice: {
                                                InvoiceID: foundXeroInvoice.InvoiceID,
                                                InvoiceNumber: order_id
                                            },
                                            Amount: Total
                                        };

                                        if(foundXeroPayment){
                                            data_to_sync.PaymentID = foundXeroPayment.PaymentID;
                                        }


                                        console.log(data_to_sync);

                                        if(!save_batch){

                                            try{

                                                var invoiceObj = xeroClient.core.payments.newPayment(data_to_sync);

                                                var saving_obj = invoiceObj.save();

                                                saving_obj.then(function(payments) {
                                                    console.log("payment created in xero");

                                                    var current_payment = payments.entities[0].toJSON();
                                                    console.log(current_payment);

                                                    xeroPaymentsObj.saveData(current_payment).then(function(saving_result){
                                                        db.close();
                                                        done(null, {success: true, result:current_payment});
                                                    });

                                                }).catch(function(err) {
                                                    //Some error occurred
                                                    //save error
                                                    console.log(err.toString());
                                                    var data_to_save = {
                                                        InvoiceNumber: order_id,
                                                        ErrorMessage: err.toString(),
                                                        DateCreated: configs.getDateToday()
                                                    };


                                                    xeroPaymentErrorsObj.saveData(data_to_save).then(function(saving_result){
                                                        db.close();
                                                        done(err, null);
                                                    });


                                                });
                                            } catch(saving_error){
                                                console.log(saving_error);
                                            }

                                        } else{
                                            //save as batch
                                            xeroPaymentsToSyncObj.saveData(data_to_sync).then(function(saving_result){
                                                console.log("batch saved");
                                                done(null, {success: true, result:data_to_sync, isBatch: save_batch});
                                            });
                                        }


                                    });

                                }


                                if(!foundXeroInvoice){
                                    console.log("Syncing Invoice to Xero FIRST!");

                                    functions_to_export.processPerInvoice(
                                        {
                                            data: {
                                                processInvoice: {
                                                    order_id: order_id
                                                }
                                            }
                                        },
                                        function(invoice_error, invoice_response){

                                            if(invoice_error){
                                                console.log(invoice_error);
                                                done(invoice_error, null);
                                            }
                                            xeroInvoiceObj.getOneData(order_id, true, {_id: 0}).then(function(foundXeroInvoice){
                                                syncXeroPayment(foundXeroInvoice);
                                            });

                                        }
                                    );

                                } else{
                                    console.log("Syncing Payment");
                                    syncXeroPayment(foundXeroInvoice);
                                }

                            });


                        } catch(major_error){
                            db.close();
                            console.log(major_error);
                            done(major_error, null);
                        }


                    } else{
                        db.close();
                        done(["Order ID does not exists"], null);
                    }
                });


            });

        } catch(error){
            console.log(error);
        }
    }
};

module.exports = functions_to_export;

