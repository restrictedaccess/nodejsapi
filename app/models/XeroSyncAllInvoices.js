var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
    order_id:{type:String},
    date_synced : Date,
};


var xeroSyncAllInvoicesSchema = new Schema(fields,
    {collection:"xero_sync_all_invoices"});



xeroSyncAllInvoicesSchema.methods.cleareAllData = function(){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllInvoices = db.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);

    db.once("open", function(){
        XeroSyncAllInvoices.remove({}, function (err) {
            db.close();
            if (err) {
                console.log(err);
                willDefer.resolve(null);
            }
            // removed!
            console.log("xero_sync_all_invoices CLEARED!");
            willDefer.resolve({success:true});
        });
    });


    return willFullfill;
};

xeroSyncAllInvoicesSchema.methods.getAllData = function(isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllInvoices = db.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);

    db.once("open", function(){
        var query = XeroSyncAllInvoices.find({}).sort({order_id: -1});

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDocs){
            if(err) console.log(err);
            db.close();
            willDefer.resolve(foundDocs);
        });
    });

    return willFullfill;
};


xeroSyncAllInvoicesSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllInvoices = db.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);

    db.once("open", function(){
        var query = XeroSyncAllInvoices.findOne({
            order_id: (order_id)
        });

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){
            db.close();
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;

}

xeroSyncAllInvoicesSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroSyncAllInvoices = db.model("XeroSyncAllInvoices", xeroSyncAllInvoicesSchema);


        function updateMongoDoc(data, callback){
            XeroSyncAllInvoices.update({order_id: (data.order_id)}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroSyncAllInvoicesObj = new XeroSyncAllInvoices(data);


            XeroSyncAllInvoicesObj.getOneData(data.order_id, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero invoices updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroSyncAllInvoices(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero invoices inserted to mongo");
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


module.exports = xeroSyncAllInvoicesSchema;