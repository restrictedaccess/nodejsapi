var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();



var schema_fields = {

    couch_id : {type:String},
    errors_from_sparkpost : {type:String},

}

var invoiceEmailResentSparkpostErrorsSchema = new Schema(schema_fields,
    {collection:"invoice_email_resent_sparkpost_errors"});



module.exports = invoiceEmailResentSparkpostErrorsSchema;


