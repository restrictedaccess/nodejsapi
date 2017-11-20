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
    InvoiceID: String,
    InvoiceNumber: String,
    Contact: Schema.Types.Mixed,
    Type: String,
    Status: String,
    DueDate: String,
    LineAmountTypes: String,
    CurrencyCode: String,
    Date: String,
    LineItems: Array
};


var xeroInvoicesToSyncSchema = new Schema(fields,
    {collection:"xero_invoices_to_sync"});



xeroInvoicesToSyncSchema.methods.cleareAllData = function(){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesToSync = db.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);

    db.once("open", function(){
        XeroInvoicesToSync.remove({}, function (err) {
            db.close();
            if (err) {
                console.log(err);
                willDefer.resolve(null);
            }
            // removed!
            console.log("xero_invoices_to_sync CLEARED!");
            willDefer.resolve({success:true});
        });
    });


    return willFullfill;
};

xeroInvoicesToSyncSchema.methods.getAllData = function(isLean, selectedFields){


    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesToSync = db.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);

    db.once("open", function(){
        var query = XeroInvoicesToSync.find({});

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

xeroInvoicesToSyncSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesToSync = db.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);

    db.once("open", function(){
        var query = XeroInvoicesToSync.findOne({
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

xeroInvoicesToSyncSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroInvoicesToSync = db.model("XeroInvoicesToSync", xeroInvoicesToSyncSchema);


        function updateMongoDoc(data, callback){
            XeroInvoicesToSync.update({InvoiceNumber: data.InvoiceNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroInvoicesToSyncObj = new XeroInvoicesToSync(data);


            XeroInvoicesToSyncObj.getOneData(data.InvoiceNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero invoice BATCH updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroInvoicesToSync(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero invoice BATCH inserted to mongo");
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


module.exports = xeroInvoicesToSyncSchema;