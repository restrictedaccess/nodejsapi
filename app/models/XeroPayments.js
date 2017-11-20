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
    PaymentID:{type:String},
    Date : String,
    BankAmount:{type:Number},
    Amount:{type:Number},
    CurrencyRate:{type:Number},
    PaymentType:{type:String},
    Status:{type:String},
    HasAccount : Boolean,
    IsReconciled : Boolean,
    Account : {
        AccountID: String,
        Name: String
    },
    CurrencyRate : Number,
    Invoice : Schema.Types.Mixed,
    HasValidationErrors : Boolean,
};


var xeroPaymentschema = new Schema(fields,
    {collection:"payments"});



xeroPaymentschema.methods.getAllData = function(isLean, selectedFields){


    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPayments = db.model("XeroPayments", xeroPaymentschema);

    db.once("open", function(){
        var query = XeroPayments.find({}).sort({"Invoice.InvoiceNumber": -1});

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

xeroPaymentschema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPayment = db.model("XeroPayment", xeroPaymentschema);

    db.once("open", function(){
        var query = XeroPayment.findOne({
            "Invoice.InvoiceNumber": order_id
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

xeroPaymentschema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroPayment = db.model("XeroPayment", xeroPaymentschema);


        function updateMongoDoc(data, callback){
            XeroPayment.update({InvoiceNumber: data.Invoice.InvoiceNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroPaymentObj = new XeroPayment(data);


            XeroPaymentObj.getOneData(data.Invoice.InvoiceNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero payment updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroPayment(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero payment inserted to mongo");
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


module.exports = xeroPaymentschema;