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

var itemValueSchema = new Schema(fields,
{collection:"order_item_values"});


module.exports = itemValueSchema;