/**
 * Created by JMOQUENDO on 7/11/17.
 */


var Queue = require('bull');
var invoice_email_reminder_main = Queue("invoice_email_reminder_main", 6379, '127.0.0.1');
// var invoice_email_reminder_sender = require("../bull/invoice-email-reminder-sender");

var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var swig  = require('swig');
var fs = require('fs');



var moment = require('moment');
var moment_tz = require('moment-timezone');

//client_settings Schema
var invoice = require("../models/Invoice");
//client_available_balance
var available_balance = require("../models/AvailableBalance");

//schema for invoice creation track
var invoiceCreationTrack = require("../models/InvoiceCreationTrack");




invoice_email_reminder_main.process(function(job,done){
    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var Invoice = db.model("Invoice", invoice);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);
    var AvailableBalance = db.model("AvailableBalance", available_balance);

    var nano = configs.getCouchDb();
    var mailbox = nano.use("mailbox");
    var couch_db = nano.use("client_docs");

    var order_id = (typeof job.data.order_id !== 'undefined' ? job.data.order_id : null);
    var resend = (typeof job.data.resend !== 'undefined' ? job.data.resend : false);
    var endOfMonth = new Date(moment().endOf('month').format('YYYY-MM-DD 00:00:00'));
    var filterTrack = { date_created: {
        '$gte': new Date(moment_tz().format("YYYY-MM-04 00:00:00")),
        '$lte': new Date(moment_tz(endOfMonth).format("YYYY-MM-DD 23:59:59"))},
        'status.success':true,
        'queue':'sent'
    };


    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");
    var timestamp = atz.toDate();
    var added_on = atz.toDate();

    function delay(){ return Q.delay(100); }
    if(order_id)
    {
        filterTrack.order_id = order_id;
    }

    function checkPaidInvoice()
    {

        db.once('open',function(){

            try{

                InvoiceCreation.find(filterTrack).lean().exec(function(err,doc_track){

                    if(doc_track.length > 0)
                    {
                        try{

                                function getDocu(i)
                                {

                                    var promises = [];
                                    var per_promise = [];


                                    if(i < doc_track.length) {
                                        item = doc_track[i];

                                        var due_date = moment(item.due_date).format('YYYY-MM-DD');
                                        var now_date = moment().format('YYYY-MM-DD');
                                        var isDue = moment(now_date).isAfter(due_date);//check if invoice is past due.
                                        var isReminder = null;
                                        if(!resend){isReminder = (typeof item.reminder !== 'undefined' ? item.reminder : null);}

                                        if(!isReminder || isReminder !== 'sent'){
                                            if (isDue) {

                                                Invoice.findOne({order_id: item.order_id}).exec(function (err, invoice) {
                                                    if (err) {
                                                        console.log(err);
                                                        getDocu(i + 1);
                                                    }

                                                    if (invoice) {
                                                        if (invoice.status == 'new') {
                                                            invoice.db = db;

                                                            var promise_client_basic_info = null;
                                                            var promise_create_html_2_pdf = null;
                                                            var promise_running_balance = null;
                                                            var promise_client_invoice_email_settings = null;

                                                            invoice.getClientInfo().then(function (result) {
                                                                if (result) {
                                                                    promise_client_basic_info = result;


                                                                    //Get Client Current Available Balance
                                                                    promise_running_balance = invoice.getCouchdbAvailableBalance();

                                                                    //Get Client email invoice settings
                                                                    promise_client_invoice_email_settings = invoice.getClientInvoiceEmailSettings();

                                                                    //Create HTML File
                                                                    promise_create_html_2_pdf = invoice.createHTML2PDF();

                                                                    per_promise.push(promise_client_basic_info);
                                                                    per_promise.push(delay);

                                                                    per_promise.push(promise_running_balance);
                                                                    per_promise.push(delay);

                                                                    per_promise.push(promise_client_invoice_email_settings);
                                                                    per_promise.push(delay);

                                                                    per_promise.push(promise_create_html_2_pdf);
                                                                    per_promise.push(delay);


                                                                    //Check all settled promises
                                                                    per_promises_promise = Q.allSettled(per_promise);
                                                                    promises.push(per_promises_promise);
                                                                    promises.push(delay);

                                                                    var allPromise = Q.allSettled(promises);

                                                                    allPromise.then(function (results) {
                                                                        var invoiceDoc = invoice.getInvoice();
                                                                        var html_file = invoiceDoc.html_file;
                                                                        var pdf_file = invoiceDoc.pdf_file;

                                                                        invoiceDoc.symbol = "$";
                                                                        if (invoiceDoc.currency == "GBP") {
                                                                            invoiceDoc.symbol = "£";
                                                                        }
                                                                        var history = invoiceDoc.history;
                                                                        var sent_date = moment(invoiceDoc.added_on).format("ddd,MMM Do YYYY");
                                                                        invoiceDoc.sent_date = sent_date;
                                                                        var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice_auto_creation/email-reminder.html');

                                                                        var cc = null;
                                                                        var subject = "Remotestaff Tax Invoice" + " " + invoiceDoc.order_id;
                                                                        var recipients = [];
                                                                        var recipients_email = [];
                                                                        var sender = "accounts@remotestaff.com.au";
                                                                        var to = [];


                                                                        if (invoiceDoc.invoice_recipients == null || invoiceDoc.invoice_recipients == undefined) {
                                                                            //recipients.push(doc.client_email);
                                                                            recipients.push({
                                                                                email: invoice.client_email,
                                                                                client_recipient: true
                                                                            });
                                                                        } else {
                                                                            recipients = invoice.invoice_recipients;
                                                                        }

                                                                        for (var x = 0; x < recipients.length; x++) {
                                                                            if (recipients[x].email != "" && recipients[x].email != null) {
                                                                                to.push(recipients[x].email);
                                                                                recipients_email.push(recipients[x].email);

                                                                            }
                                                                        }

                                                                        var output = template({
                                                                            invoice: invoiceDoc
                                                                        });

                                                                        var mailbox_doc = {
                                                                            bcc: null,
                                                                            cc: null,
                                                                            created: [moment(added_on).year(), moment(added_on).month() + 1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
                                                                            from: "accounts@remotestaff.com.au",
                                                                            sender: sender,
                                                                            reply_to: null,
                                                                            generated_by: "NODEJS/invoice-auto-creation/invoice-email-reminder/",
                                                                            html: output,
                                                                            text: null,
                                                                            to: to,
                                                                            // sent : false,
                                                                            subject: subject
                                                                        };

                                                                        var changes = "Email sent to  " + recipients_email.join();
                                                                        // Insert document in couchdb mailbox
                                                                        invoice.sendMailbox(mailbox_doc).then(function (couch_id) {
                                                                            //Attach PDF
                                                                            invoice.attachPDF(couch_id, pdf_file).then(function (pdf_filename) {
                                                                                //Update mailbox document
                                                                                invoice.updateMailboxDoc(couch_id).then(function (result) {
                                                                                    //do nothing
                                                                                    // console.log(result);
                                                                                    console.log('sent');

                                                                                    if (fileExists(html_file)) {
                                                                                        console.log("File still exist " + html_file);
                                                                                        fs.unlink(html_file, function (err) {
                                                                                            if (err) {
                                                                                                console.log(err);
                                                                                            }
                                                                                            console.log("Deleted " + html_file);
                                                                                        });

                                                                                    }updateTrack();
                                                                                });
                                                                            });
                                                                        });


                                                                        function fileExists(path) {

                                                                            try {
                                                                                return fs.statSync(path).isFile();

                                                                            }
                                                                            catch (e) {

                                                                                if (e.code == 'ENOENT') { // no such file or directory. File really does not exist
                                                                                    console.log("File does not exist.");
                                                                                    return false;
                                                                                }

                                                                                console.log("Exception fs.statSync (" + path + "): " + e);
                                                                                //throw e; // something else went wrong, we don't have rights, ...
                                                                                return false;

                                                                            }
                                                                        }


                                                                        function updateTrack()
                                                                        {
                                                                            var filter = {order_id:item.order_id};

                                                                            history.push({
                                                                                timestamp : timestamp,
                                                                                changes : changes,
                                                                                by :"System"
                                                                            });

                                                                            invoice.history = history;
                                                                            invoice.sent_last_date = timestamp;

                                                                            //update mongo document history
                                                                            invoice.save(function(err, updated_doc){

                                                                                if (err){
                                                                                    console.log(err);
                                                                                    getDocu(i + 1);
                                                                                }
                                                                                // Update Couchdb history
                                                                                couch_db.get(invoice.couch_id, function(err, couch_doc) {

                                                                                    if(couch_doc)
                                                                                    {
                                                                                        updaterev = couch_doc._rev;
                                                                                        couch_doc._rev = updaterev;

                                                                                        couch_doc.sent_last_date = timestamp;
                                                                                        couch_doc.mongo_synced = true;
                                                                                        var history = couch_doc.history;
                                                                                        history.push({
                                                                                            timestamp : timestamp,
                                                                                            changes : changes,
                                                                                            by : "System"
                                                                                        });
                                                                                        couch_doc.history = history;
                                                                                        couch_db.insert(couch_doc, invoice.couch_id, function(err, body , header) {
                                                                                            if (err){
                                                                                                console.log(err);
                                                                                                getDocu(i + 1);
                                                                                            }
                                                                                        });
                                                                                    }


                                                                                });

                                                                                    InvoiceCreation.findOneAndUpdate(filter, {reminder:'sent'}, {upsert: true}, function (err, doc) {
                                                                                        if (err) {
                                                                                            console.log(err);
                                                                                            getDocu(i + 1);
                                                                                        }
                                                                                        console.log("Success adding track");

                                                                                        setTimeout(function () {
                                                                                            getDocu(i + 1);
                                                                                        }, 800);
                                                                                    });

                                                                            });
                                                                        }


                                                                    });
                                                                }
                                                                else {
                                                                    getDocu(i + 1);
                                                                }
                                                            });


                                                        }
                                                        else {
                                                            getDocu(i + 1);
                                                        }
                                                    }
                                                    else {
                                                        getDocu(i + 1);
                                                    }

                                                });
                                            }
                                            else {
                                                getDocu(i + 1);
                                            }
                                        }
                                        else
                                        {
                                            console.log('already sent'+ " "+ item.order_id);
                                            getDocu(i + 1);
                                        }
                                    }
                                    else
                                    {
                                        console.log('done');
                                        db.close();
                                        done(null,{success:true});
                                    }

                                }
                                getDocu(0);

                        }catch(e){
                            console.log(e);
                            db.close();
                            done(null,{success:false});
                        }

                    }
                    else
                    {
                        console.log('walang laman');
                        db.close();
                        done(null,{success:false});
                    }

                });

            }catch(e)
            {
                console.log(e);
                db.close();
                done(null,{success:false});
            }


        });

    }


    checkPaidInvoice();
    // done(null,{success:false});


});


module.exports = invoice_email_reminder_main;