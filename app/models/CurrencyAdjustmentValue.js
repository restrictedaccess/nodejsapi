var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var fields = {
    order_id:String,
    value:Number,
    date:String,
    status:String,
    client_id:Number,
    subcontractors_id:Number,
    month:Number,
    year:Number,
    key:String,
    timestamp:Number
};

var currencyAdjustmentValueSchema = new Schema(fields,
{collection:"currency_adjustment_values"});


module.exports = currencyAdjustmentValueSchema;