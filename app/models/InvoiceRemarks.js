var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var invoiceSchema = require("../models/Invoice");
var clientSchema = require("../models/Client");


var schema_fields = {

    order_id : {type:String},
    remark_date: {type:Date},
    remarked_by : {type:Number}

}

var invoiceRemarksSchema = new Schema(schema_fields,
    {collection:"invoice_remarks"});



module.exports = invoiceRemarksSchema;