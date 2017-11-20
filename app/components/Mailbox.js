var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var http = require('http');

var moment = require('moment');
var moment_tz = require('moment-timezone');

var env = require("../config/env");
var mongoCredentials = configs.getMongoCredentials();

// much more concise declaration
function Mailbox() {

}

/**
 * Save to mailbox couch
 *
 bcc : ["devs@remotestaff.com.au"],
 cc : [ cc ],
 from : "noreply@remotestaff.com.au",
 sender : req.body.sc_email,
 reply_to : null,
 generated_by : "NODEJS/send/sa-sc/",
 html : output,
 text : null,
 to : to,
 sent : false,
 subject : subject
 *
 *
 * @param mailbox_doc
 * @returns {*}
 */
Mailbox.prototype.send = function(mailbox_doc){

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var nano = configs.getCouchDb();
    var mailbox = nano.use("mailbox");

    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");

    var added_on = atz.toDate();

    mailbox_doc.created = [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()];

    mailbox.insert(mailbox_doc, function(err, body){
        if (err){
            console.log(err);
            var result = {success:false, error : err.error};
            willFulfillDeferred.resolve(result);
        }
        else {
            var result = {
                success:true,
                msg : "Email successfully sent!",
            };
            willFulfillDeferred.resolve(result);
        }
    });

    return willFulfill;
}

// no need to overwrite `exports` ... since you're replacing `module.exports` itself
module.exports = Mailbox;