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
    Account : {
        AccountID: String,
        Name: String
    },
    Invoice : Schema.Types.Mixed,
    Amount: {type:Number},
    Date : String
};


var xeroPaymentsToSyncSchema = new Schema(fields,
    {collection:"xero_payments_to_sync"});


xeroPaymentsToSyncSchema.methods.cleareAllData = function(){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPaymentsToSync = db.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);

    db.once("open", function(){
        XeroPaymentsToSync.remove({}, function (err) {
            db.close();
            if (err) {
                console.log(err);
                willDefer.resolve(null);
            }
            // removed!
            console.log("xero_payments_to_sync CLEARED!");
            willDefer.resolve({success:true});
        });
    });


    return willFullfill;
};


xeroPaymentsToSyncSchema.methods.getAllData = function(isLean, selectedFields){


    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPaymentsToSync = db.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);

    db.once("open", function(){
        var query = XeroPaymentsToSync.find({}).sort({"Invoice.InvoiceNumber": -1});

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

xeroPaymentsToSyncSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPaymentsToSync = db.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);

    db.once("open", function(){
        var query = XeroPaymentsToSync.findOne({
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

xeroPaymentsToSyncSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroPaymentsToSync = db.model("XeroPaymentsToSync", xeroPaymentsToSyncSchema);


        function updateMongoDoc(data, callback){
            XeroPaymentsToSync.update({"Invoice.InvoiceNumber": data.Invoice.InvoiceNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroPaymentToSyncObj = new XeroPaymentsToSync(data);


            XeroPaymentToSyncObj.getOneData(data.Invoice.InvoiceNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero payment BATCH updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroPaymentsToSync(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero payment BATCH inserted to mongo");
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


module.exports = xeroPaymentsToSyncSchema;