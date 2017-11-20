/**
 * Created by JMOQUENDO on 6/27/17.
 */

var mongoose = require('mongoose');
require('mongoose-double')(mongoose);
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var SchemaTypes = mongoose.Schema.Types;

var invoiceCreationSchema = new Schema({
        client_id:{type:Number},
        client_fname:{type:String},
        client_lname:{type:String},
        client_email:{type:String},
        client_names:[],
        order_id:{type:String},
        date_created:{type:Date},
        invoice_date : {type:Date},
        due_date : {type:Date},
        queue : {type:String},
        status:{
            success:{type:Boolean},
            msg:{type:String},
            api:{type:String}
        },
        currency:{type:String},
        total_amount:{type:SchemaTypes.Double},
        reminder:{type:String},
        suspended:{type:Boolean}
    },

    {collection:"invoice_creation_track"});

module.exports = invoiceCreationSchema;