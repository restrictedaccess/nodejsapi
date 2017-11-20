var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var env = require("../config/env");
var console = require('console');
var mongoose = require('mongoose');
var subcontractorSchema = require("../models/Subcontractor");
var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");

var CurrencyAdjustmentRegularInvoicing = require("../mysql/CurrencyAdjustmentRegularInvoicing");
var adminInfoSchema = require("../mysql/Admin_Info");
var currencyRateMarginSchema = require("../mysql/CurrencyRateMargin");

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var is_numeric = require('locutus/php/var/is_numeric')

// much more concise declaration
function CurrencyAdjustments() {

}



CurrencyAdjustments.prototype.save = function(req) {


    var ultimateDefer = Q.defer();
    var ultimatePromise = ultimateDefer.promise;


    var success = true;
    var error_msg = "";
    if (!req.query.admin_id) {
        error_msg += "Admin id is missing. ";
    }


    if (!req.query.currency) {
        error_msg += "Currency is missing. ";
    }

    if (!req.query.rate) {
        error_msg += "Rate is missing. ";
    }


    if (!is_numeric(req.query.rate)) {
        error_msg += "Invalid currency rate. ";
    }

    var admin_id = parseInt(req.query.admin_id);
    var currency = req.query.currency;
    var rate = parseFloat(req.query.rate).toFixed(2);
    var effective_date = moment(req.query.effective_date).format("YYYY-MM-DD");

    var scheduled = false;
    if (effective_date != moment_tz().format("YYYY-MM-DD")) {
        scheduled = true;
    }


    var MailboxComponent = require("../components/Mailbox");
    var mailbox = new MailboxComponent();
    var swig = require('swig');
    var scheduledCurrencyAdjustmentsSchema = require("../mysql/ScheduledCurrencyAdjustments");

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/currency_adjustments", mongoCredentials.options);
    var CurrencyRateHistorySchema = require("../models/CurrencyRateHistory");

    var CurrencyRateHistory = db.model("CurrencyRateHistory", CurrencyRateHistorySchema);

    db.once('open', function () {
        //Check if admin is allowed
        adminInfoSchema.isAdminAllowedCurrencyAdjustment(admin_id).then(function (is_allowed) {
            if (!is_allowed) {
                ultimateDefer.resolve({
                    success: false,
                    msg: "Admin is not allowed to access currency adjustment"
                });
                //return res.status(200).send();
            } else {

                //check and removed pending scheduled update of rate of this currency
                scheduledCurrencyAdjustmentsSchema.removePending(currency).then(function (updateData) {
                    var bcc_array = [];
                    var cc_array = [];
                    var to_array = [];
                    var text = null;

                    var from = "noreply<noreply@remotestaff.com.au>";

                    if (env.environment != "production") {
                        to_array.push("devs@remotestaff.com.au");
                    } else {
                        bcc_array.push("devs@remotestaff.com.au");
                        cc_array.push("accounts@remotestaff.com.au");
                        to_array.push("chrisj@remotestaff.com.au");
                    }

                    //fetch admin info
                    adminInfoSchema.getAdminInfo(admin_id).then(function (admin_info) {
                        var admin = admin_info;
                        var subject = "New Currency Adjustment Rate for " + currency;

                        var data = {
                            admin_id: admin_id,
                            currency: currency,
                            rate: rate,
                            effective_date: effective_date,
                            status: "pending",
                            date_added: configs.getDateToday()
                        };
                        var mongo_data = {
                            currency: currency,
                            rate: rate,
                            date_added: configs.getDateToday(),
                            effective_date: effective_date,
                            admin_id: admin_id,
                            admin: admin_info.admin_fname + " " + admin_info.admin_lname,
                        };

                        var scheduled_adjustment_evaluation_defer = Q.defer();
                        var scheduled_adjustment_evaluation_promise = scheduled_adjustment_evaluation_defer.promise;


                        if (scheduled) {
                            subject = "Schduled Currency Adjustment Rate for " + currency;
                            mongo_data.log = "Scheduled currency rate update";
                            scheduledCurrencyAdjustmentsSchema.saveData(data);

                            scheduled_adjustment_evaluation_defer.resolve(data);

                        } else {
                            mongo_data.log = "Added new currency rate";
                            //check all records if there's an existing active currency_adjustments records for this currency. currency_adjustments.active = 'yes' and currency_adjustments.currency = $_POST["currency"]
                            //Update records
                            CurrencyAdjustment.updateDataByCurrency(currency, {active: "no"}).then(function (updateResult) {

                                data.active = "yes";

                                CurrencyAdjustment.saveData(data);

                                //update previous adjustment set active = no
                                scheduled_adjustment_evaluation_defer.resolve(data);

                            });

                        }

                        //save history to mongo
                        scheduled_adjustment_evaluation_promise.then(function (schedule_evaluation_result) {

                            try{

                                var path = require("path");
                                var ca_email_path = path.join(__dirname , "..", "emaillayouts");
                                ca_email_path += "/currency_adjustment/currency_adjustments.html";
                                console.log(ca_email_path);

                                var template = swig.compileFile(ca_email_path);
                                var output = template({
                                    subject: subject,
                                    data: data,
                                    admin: admin_info
                                });


                                var MailboxComponent = require("../components/Mailbox");
                                var mailbox_component = new MailboxComponent();

                                var mailbox_doc = {
                                    bcc: bcc_array,
                                    cc: cc_array,
                                    from: from,
                                    sender: null,
                                    reply_to: null,
                                    generated_by: "NODEJS/currency-adjustments/save",
                                    html: output,
                                    text: text,
                                    to: to_array,
                                    sent: false,
                                    subject: subject
                                };

                                console.log("sending mail " + subject);
                                mailbox_component.send(mailbox_doc);


                                var mongo_history = new CurrencyRateHistory(mongo_data);

                                mongo_history.save(function (err) {
                                    db.close();
                                    if (err) {
                                        console.log(err);
                                        ultimateDefer.resolve({success: false, error: err});
                                        // res.status(200).send({success: false, error: err});
                                    }
                                    ultimateDefer.resolve({success: true, scheduled: scheduled, msg: subject});
                                    //res.status(200).send({success: true, scheduled: scheduled, msg: subject});
                                });
                            } catch(major_error){
                                console.log(major_error);
                            }
                        });

                    });

                });
            }

        });
    });

    return ultimatePromise;
}


// no need to overwrite `exports` ... since you're replacing `module.exports` itself
module.exports = new CurrencyAdjustments();