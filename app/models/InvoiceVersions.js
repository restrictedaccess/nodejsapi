/**
 * Created by joenefloresca on 27/06/2017.
 */
/**
 * Created by joenefloresca on 20/06/2017.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();


var fields = {
    sent_on:{type:Date},
    version:{type:Number},
    couch_id:{type:String},
    order_id:{type:String, required:true},
    client_id:{type:Number, required:true},
    items:Array,
    status:String,
    sent_flag:String,
    pay_before_date:{type:Date, required:true},
    added_on:Date,
    added_on_formatted:String,
    payment_advise:Boolean,
    client_fname : {type:String, required:true},
    client_lname : {type:String, required:true},
    client_email : {type:String, required:true},
    currency : {type:String, required:true},
    total_amount : {type:Number, required:true},
    added_on_string : String,
    pay_before_date_string : String,
    pay_before_date : Date,
    date_paid : String,
    date_cancelled : Date,
    date_cancelled_to_new : Date,
    comments:Array,
    history:Array,
    invoice_setup:String,
    pay_before_date_unix:{type:Number},
    sub_total:{type:Number, required:true},
    gst_amount:{type:Number, required:true},
    client_names:Array,
    apply_gst:String,
    running_balance:Number,
    added_by:{type:String, required:true},
    mongo_synced:Boolean,
    item_type:Array,
    disable_auto_follow_up:String,
    overpayment_from : String,
    overpayment_from_doc_id : String,
    type:String,
    last_date_updated:Date,
    date_paid_date:Date
    //company_name : String,
    //company_address : String,
    //officenumber : String,
    //mobile : String
};

var invoiceVersionsSchema  = new Schema(fields,{
    versionKey: false,
    collection:"invoice_versions"
});

module.exports = invoiceVersionsSchema;