var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var fields = {
    currency_adjustments_regular_invoicing_id:Number,
    admin_id:Number,
    admin:String,
    date_added : Date,    
    previous_rate:Number,
    current_rate:Number,
    currency:String,
    history:String
};

var currencyAdjustmentsRegularInvoicingHistorySchema = new Schema(fields,
{collection:"currency_adjustments_regular_invoicing_history"});
module.exports = currencyAdjustmentsRegularInvoicingHistorySchema;