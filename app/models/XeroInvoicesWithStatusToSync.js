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


var xeroInvoicesWithStatusToSyncSchema = new Schema(fields,
    {collection:"xero_invoices_with_status_to_sync"});



xeroInvoicesWithStatusToSyncSchema.methods.cleareAllData = function(){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesWithStatusToSync = db.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);

    db.once("open", function(){
        XeroInvoicesWithStatusToSync.remove({}, function (err) {
            db.close();
            if (err) {
                console.log(err);
                willDefer.resolve(null);
            }
            // removed!
            console.log("xero_invoices_with_status_to_sync CLEARED!");
            willDefer.resolve({success:true});
        });
    });


    return willFullfill;
};

xeroInvoicesWithStatusToSyncSchema.methods.getAllData = function(isLean, selectedFields){


    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesWithStatusToSync = db.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);

    db.once("open", function(){
        var query = XeroInvoicesWithStatusToSync.find({});

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

xeroInvoicesWithStatusToSyncSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroInvoicesWithStatusToSync = db.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);

    db.once("open", function(){
        var query = XeroInvoicesWithStatusToSync.findOne({
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

xeroInvoicesWithStatusToSyncSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroInvoicesWithStatusToSync = db.model("XeroInvoicesWithStatusToSync", xeroInvoicesWithStatusToSyncSchema);


        function updateMongoDoc(data, callback){
            XeroInvoicesWithStatusToSync.update({InvoiceNumber: data.InvoiceNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroInvoicesWithStatusToSyncObj = new XeroInvoicesWithStatusToSync(data);


            XeroInvoicesWithStatusToSyncObj.getOneData(data.InvoiceNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero invoice with status BATCH updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroInvoicesWithStatusToSync(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero invoice with status BATCH inserted to mongo");
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


module.exports = xeroInvoicesWithStatusToSyncSchema;