/**
 * Created by joenefloresca on 20/06/2017.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var fields = {
    invoice_number:{type:String},
    date_updated:{type:Date},
    updated_by_admin_id:{type:Number},
    updated_by_admin_name:{type:String},
    status:{type:String}
}

var invoiceModificationsSchema  = new Schema(fields,{
    versionKey: false,
    collection:"invoice_modifications"
});

module.exports = invoiceModificationsSchema;