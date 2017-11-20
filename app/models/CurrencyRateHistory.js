
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var moment = require('moment');
var moment_tz = require('moment-timezone');
var fields = {
    rate:Number,
    currency:String,
    effective_date:String,
    date_added:Date,
    admin_id:String,
    admin:String,
    log:String,
};

var currencyRateHistorySchema = new Schema(fields,
    {collection:"currency_rate_history"});

currencyRateHistorySchema.methods.fetchAllHistory = function()
{

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;
    var me = this;
    var db = this.db;
    var currencyRateHIstoryModel = db.model("CurrencyRateHistory", currencyRateHistorySchema);
    currencyRateHIstoryModel.find({}).sort({date_added:-1}).lean().exec(function(err, foundDocs){
        var histories = [];
        if(foundDocs){
            for(var i = 0;i < foundDocs.length;i++){
                /**
                 *
                 "doc_id" => $result["_id"]->{'$id'},
                 "currency" => $result["currency"],
                 "rate" => number_format($result["rate"], 2, ".", ""),
                 "effective_date" => $result["effective_date"],
                 "admin" => $result["admin"],
                 "date_added" => date("M d, Y h:i:a", $result["date_added"]->sec),
                 "log" => $result["log"]
                 */
                var current_history = foundDocs[i];
                var history = {};
                history.doc_id = current_history._id;
                history.currency = current_history.currency;
                history.rate = current_history.rate.toFixed(2);
                history.effective_date = current_history.effective_date;
                history.admin = current_history.admin;
                history.date_added = moment.utc(current_history.date_added).format("MMM DD, YYYY h:mm A");
                history.log = current_history.log;
                histories.push(history);
            }
        }
        willDefer.resolve(histories);
    });

    return willFullfill;
}

module.exports = currencyRateHistorySchema;