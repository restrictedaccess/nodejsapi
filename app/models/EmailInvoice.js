var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var invoiceSchema = require("../models/Invoice");
var clientSchema = require("../models/Client");


var schema_fields = {

    ip : {type:String},
    client_fname : {type:String},
    client_lname : {type:String},
    client_full_name : {type:String},
    response : {type:String},
    sg_event_id : {type:String},
    sg_message_id : {type:String},
    tls : {type:Number},
    event : {type:String},
    email : {type:String},
    timestamp : {type:Number},
    smtp_id : {type:String},
    accounts_order_id : {type:String},
    status: {type:String},
    date_delivered : {type:Date},
    date_clicked : {type:Date},
    date_opened : {type:Date},
    date_updated : {type:Date},
    invoice_date_created : {type:Date},
    added_by : {type:String},
    email_status : {type:String},
    age_in_days : {type:Number},
    invoice_date_created : {type:Date},
    couch_id: {type:String},

}

var emailInvoiceSchema = new Schema(schema_fields,
    {collection:"delivered_invoices"});



emailInvoiceSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice");
    var EmailInvoice = db.model("EmailInvoice", emailInvoiceSchema);

    db.once("open", function(){
        var query = EmailInvoice.findOne({
            accounts_order_id: order_id
        });

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){
            db.close();
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;

}

//for invoice email reporting
emailInvoiceSchema.methods.saveInvoiceEmailDelivered = function(order_id, couch_id)
{
    var suppressionReportingSchema = require("../models/SuppressionReporting");
    function delay(){ return Q.delay(100); }
    var me = this;

    this.db_invoice = this.db;

    this.db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    //this.db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);

    var Invoice = this.db.model("Invoice", invoiceSchema);
    var Suppression = this.db_invoice.model("Suppression", suppressionReportingSchema);


    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var allDeferredPromises = [];


    var invoiceFetchDeferred = Q.defer();
    var invoiceFetchPromise = invoiceFetchDeferred.promise;
    allDeferredPromises.push(invoiceFetchPromise);
    allDeferredPromises.push(delay);

    // var clientFetchDeferred = Q.defer();
    // var clientFetchPromise = clientFetchDeferred.promise;
    // allDeferredPromises.push(clientFetchPromise);
    // allDeferredPromises.push(delay);

    var suppressionFetchDeferred = Q.defer();
    var suppressionFetchPromise = suppressionFetchDeferred.promise;
    allDeferredPromises.push(suppressionFetchPromise);
    allDeferredPromises.push(delay);

    var emailSaveDeferred = Q.defer();
    var emailSavePromise = emailSaveDeferred.promise;
    allDeferredPromises.push(emailSavePromise);
    allDeferredPromises.push(delay);


    this.db.once('open', function() {
        //me.db_invoice.once("open", function () {

            Invoice.findOne({order_id: order_id}).sort({added_on: -1}).lean().exec(function (err, foundInvoice) {
                if(foundInvoice){
                    console.log("Invoice found for " + order_id);
                    me.email = foundInvoice.client_email;
                    me.client_fname = foundInvoice.client_fname;
                    me.client_lname = foundInvoice.client_lname;
                    me.client_full_name = foundInvoice.client_fname + " " + foundInvoice.client_lname;
                    me.date_delivered = new Date();
                    me.date_updated = new Date();
                    me.invoice_date_created = foundInvoice.added_on;
                    me.accounts_order_id = order_id;
                    if(typeof me.email_status == "undefined" && !me.email_status){
                        me.email_status = "Not Opened";
                    }
                    me.couch_id = couch_id;


                    Suppression.findOne({email: me.email.toLowerCase()}).exec(function(err, suppression_doc){
                        if(suppression_doc){

                            var notes = "";
                            if(suppression_doc.suppression_type == "bounces"){
                                me.email_status = "Bounce";
                                notes = "Bounced: Email bounced - email address is wrong - check with client";
                            } else if(suppression_doc.suppression_type == "blocks"){
                                me.email_status = "Block";
                                notes = "Blocked: Email is being blocked - ask client for alternative email address";
                            } else if(suppression_doc.suppression_type == "spam_reports"){
                                me.email_status = "Spam";
                                notes = "Spam: Email is blocked by spam filter - check with client";
                            } else if(suppression_doc.suppression_type == "invalid_emails"){
                                me.email_status = "Invalid";
                                notes = "Invalid Email: Something wrong with the email address - check with client";
                            }

                            //me.date_updated = new Date();

                            //var existing_suppression = new Suppression(suppression_doc);

                            suppression_doc.saveInvoiceNotes(notes, me.accounts_order_id);
                        }

                        me.save(function(err){
                            if (err){
                                console.log(err);
                                console.log("error saving delivered_invoices with updated email_status!");
                                result = {success:false, errors:err};
                            } else{
                                console.log("Saved to delivered_invoices " + order_id);
                            }
                            me.db.close();

                            emailSaveDeferred.resolve({success:true, error: err});
                            willFulfillDeferred.resolve({success:true});
                        });

                        suppressionFetchDeferred.resolve({success:true});
                    });


                } else{
                    console.log(err);
                    willFulfillDeferred.resolve(false);
                }

                invoiceFetchDeferred.resolve({success:true});
            });
        //});
    });


    var allPromise = Q.allSettled(allDeferredPromises);
    allPromise.then(function(results){
        console.log("All Promises Deferred Done!");
    });


    return willFulfill;
}


//for invoice email reporting
emailInvoiceSchema.methods.getreportFields = function()
{

    var suppressionReportingSchema = require("../models/SuppressionReporting");
    var invoiceEmailResentSparkpostSchema = require("../models/InvoiceEmailResentSparkpost");
    this.db_invoice = this.db;
    function delay(){ return Q.delay(100); }
    var MongoClient = require('mongodb').MongoClient;
    this.db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    // this.db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);

    var Invoice;

    Invoice = this.db.model("Invoice", invoiceSchema);
    var SuppressionReporting = this.db_invoice.model("SuppressionReporting", suppressionReportingSchema);
    var InvoiceEmailResentSparkpost = this.db_invoice.model("InvoiceEmailResentSparkpost", invoiceEmailResentSparkpostSchema);


    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var allDeferredPromises = [];


    var invoiceFetchDeferred = Q.defer();
    var invoiceFetchPromise = invoiceFetchDeferred.promise;
    allDeferredPromises.push(invoiceFetchPromise);
    allDeferredPromises.push(delay);

    var clientFetchDeferred = Q.defer();
    var clientFetchPromise = clientFetchDeferred.promise;
    allDeferredPromises.push(clientFetchPromise);
    allDeferredPromises.push(delay);

    var suppressionFetchDeferred = Q.defer();
    var suppressionFetchPromise = suppressionFetchDeferred.promise;
    allDeferredPromises.push(suppressionFetchPromise);

    var resentSparkpostCountFetchDeferred = Q.defer();
    var resentSparkpostCountFetchPromise = resentSparkpostCountFetchDeferred.promise;
    allDeferredPromises.push(resentSparkpostCountFetchPromise);
    allDeferredPromises.push(delay);



    var me = this;

    var filter = {order_id:this.accounts_order_id};

    this.db.once('open', function() {
        //me.db_invoice.once("open", function(){
            console.log("Trying to fetch " + me.accounts_order_id);
            Invoice.find(filter).select(
                {
                    _id: 1,
                    client_id: 1,
                    client_email: 1,
                    total_amount: 1,
                    pay_before_date: 1,
                    currency: 1,
                    comments: 1,
                    client_fname: 1,
                    client_lname: 1,
                    lead: 1,
                }
            ).sort({added_on: -1}).lean().exec(function (err, invoices) {
                if (!err) {

                    if(invoices){
                        if(invoices.length > 0){

                            try{

                                var ClientData;

                                ClientData = me.db.model("Client", clientSchema);
                                var search_filter = {client_id:parseInt(invoices[0].client_id)};
                            } catch(major_error){
                                console.log("Major Error");
                                console.log(major_error);
                                willFulfillDeferred.resolve(false);
                            }


                            ClientData.find(search_filter).lean().exec(function(err, client_basic_info){

                                try{

                                    client_basic_info = client_basic_info[0];
                                    delete ClientData.full_content;

                                    var basic_info = {
                                        fname : invoices[0].client_fname,
                                        lname : invoices[0].client_lname,
                                        email : invoices[0].client_email,
                                        company_name : client_basic_info.lead.company_name,
                                        company_address : client_basic_info.lead.company_address,
                                        officenumber : client_basic_info.lead.officenumber,
                                        mobile : client_basic_info.lead.mobile,
                                        supervisor_email : client_basic_info.lead.supervisor_email,
                                        acct_dept_email1 : client_basic_info.lead.acct_dept_email1,
                                        acct_dept_email2 : client_basic_info.lead.acct_dept_email2,
                                        sec_email : client_basic_info.lead.sec_email,
                                        days_before_suspension : client_basic_info.client_doc.days_before_suspension,
                                        client_settings_email: client_basic_info.lead.email
                                    };


                                    me.client_basic_info = basic_info;
                                    me.invoices = invoices;

                                    var result = {
                                        invoices:invoices,
                                        client:me
                                    };

                                    //fetch from suppression_reporting
                                    SuppressionReporting.findOne({email: invoices[0].client_email.toLowerCase()}).sort({created: -1}).lean().exec(function(err, suppression_details){

                                        if(suppression_details){
                                            me.suppression_details = suppression_details;
                                        } else{
                                            console.log(err + " suppression_reporting fetch");
                                        }
                                        //me.db_invoice.close();
                                        suppressionFetchDeferred.resolve({success:true});


                                    });


                                    //fetch from suppression_reporting
                                    InvoiceEmailResentSparkpost.findOne({order_id: invoices[0].order_id}).lean().exec(function(err, sparkpost_resent_data){

                                        if(sparkpost_resent_data){
                                            me.sparkpost_resent_data = sparkpost_resent_data;
                                        } else{
                                            console.log(err + " sparkpost_resent_data fetch");
                                        }
                                        //me.db.close();
                                        //me.db_invoice.close();
                                        resentSparkpostCountFetchDeferred.resolve({success:true});

                                        // willFulfillDeferred.resolve(result);

                                    });

                                    clientFetchDeferred.resolve({success:true});

                                } catch(major_error){
                                    console.log("Error Fetching " + me.accounts_order_id);
                                    console.log(major_error);
                                    willFulfillDeferred.resolve(false);
                                }


                            });
                        } else{

                            console.log("No invoices found" + me.accounts_order_id);
                            willFulfillDeferred.resolve(false);
                        }
                    } else{

                        console.log("No invoices found" + me.accounts_order_id);
                        willFulfillDeferred.resolve(false);
                    }

                }
                else{
                    console.log("Error fetching Invoice " + me.accounts_order_id);
                    console.log(err);
                    willFulfillDeferred.resolve(false);
                }

                invoiceFetchDeferred.resolve({success:true});
            });
        //});



        var allPromise = Q.allSettled(allDeferredPromises);
        allPromise.then(function(results){
            console.log("All Promises Deferred Done!" + me.accounts_order_id);

            me.db.close();
            willFulfillDeferred.resolve(results);
        });


    });

    return willFulfill;

};


emailInvoiceSchema.methods.getInvoiceCreationView = function(){

    var temp = {};
    try{

        var client = this;
        var invoices_reporting = this.invoices;
        var basic_info = this.client_basic_info;
        var suppression_details = this.suppression_details;
        if(suppression_details){
            temp.suppression_type = suppression_details.suppression_type;
            temp.suppression_reason = suppression_details.reason;
            temp.suppression_date = suppression_details.created;
        }

        temp.sparkpost_resend_counter = 0;

        if(typeof this.sparkpost_resent_data != "undefined"){
            temp.sparkpost_resend_counter = this.sparkpost_resent_data.count;
        }

        temp.client_fname = basic_info.fname;
        temp.client_lname = basic_info.lname;
        temp.client_settings_email = basic_info.client_settings_email;
        temp.client_email = invoices_reporting.client_email;
        temp.order_id = client.accounts_order_id;
        temp.invoice_date_created = client.invoice_date_created;
        temp.date_delivered = client.date_delivered;
        temp.added_by = client.added_by;
        temp.email_status = client.email_status;
        temp.age_in_days = client.age_in_days;
        temp.date_opened = (client.date_opened ? client.date_opened : null  );
        temp.date_delivered = client.date_delivered;
        temp.date_clicked = (client.date_clicked ? client.date_clicked : null );
        temp.date_updated = (client.date_updated ? client.date_updated : null);
        temp.days_before_suspension = basic_info.days_before_suspension;
        temp.client_mobile = basic_info.mobile;
        temp.client_docs = invoices_reporting;
        if(typeof this.couch_id != "undefined"){
            temp.couch_id = this.couch_id;
        }
    } catch(major_error){
        console.log("Error creating view");
        console.log(major_error);
    }

    return temp;
};


module.exports = emailInvoiceSchema;
