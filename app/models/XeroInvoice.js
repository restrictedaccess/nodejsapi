var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
    Type:{type:String},
    InvoiceID:{type:String},
    InvoiceNumber:{type:String},
    Reference:{type:String},
    Prepayments:{type:Array},
    Overpayments:{type:Array},
    AmountDue : Number,
    AmountPaid : Number,
    SentToContact : Boolean,
    CurrencyRate : Number,
    HasErrors : Boolean,
    IsDiscounted : Boolean,
    Contact : Schema.Types.Mixed,
    LineAmountTypes : String,
    LineItems : Array,
    DueDateString : String,
    DueDate : String,
    Status : String,
    SubTotal : Number,
    TotalTax : Number,
    Total : Number,
    UpdatedDateUTC : String,
    CurrencyCode : String,
    Warnings : Array,
};


var xeroInvoiceSchema = new Schema(fields,
    {collection:"invoices"});


xeroInvoiceSchema.methods.getAllData = function(isLean, selectedFields){


    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoice = db.model("XeroInvoice", xeroInvoiceSchema);

    db.once("open", function(){
        var query = XeroInvoice.find({}).sort({InvoiceNumber: -1});

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){

            db.close();
            if(err) console.log(err);
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;
};

xeroInvoiceSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoice = db.model("XeroInvoice", xeroInvoiceSchema);

    db.once("open", function(){
        var query = XeroInvoice.findOne({
            InvoiceNumber: order_id
        });

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){

            db.close();
            if(err) console.log(err);
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;

}

xeroInvoiceSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroInvoice = db.model("XeroInvoice", xeroInvoiceSchema);


        function updateMongoDoc(data, callback){
            XeroInvoice.update({InvoiceNumber: data.InvoiceNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroInvoiceObj = new XeroInvoice(data);


            XeroInvoiceObj.getOneData(data.InvoiceNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero invoice updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroInvoice(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero invoice inserted to mongo");
                        willDefer.resolve(foundDoc);
                    });
                }

            });
        });

    } catch(major_error){
        consol.log(major_error);
    }

    return willFullfill;

}


module.exports = xeroInvoiceSchema;