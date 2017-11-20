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


var xeroSyncAllPaymentsSchema = new Schema(fields,
    {collection:"xero_sync_all_payments"});


xeroSyncAllPaymentsSchema.methods.getAllData = function(isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllPayments = db.model("XeroSyncAllPayments", xeroSyncAllPaymentsSchema);

    db.once("open", function(){
        var query = XeroSyncAllPayments.find({}).sort({order_id: -1});

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


xeroSyncAllPaymentsSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllPayments = db.model("XeroSyncAllPayments", xeroSyncAllPaymentsSchema);

    db.once("open", function(){
        var query = XeroSyncAllPayments.findOne({
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

xeroSyncAllPaymentsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroSyncAllPayments = db.model("XeroSyncAllPayments", xeroSyncAllPaymentsSchema);


        function updateMongoDoc(data, callback){
            XeroSyncAllPayments.update({order_id: (data.order_id)}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroSyncAllPaymentsObj = new XeroSyncAllPayments(data);


            XeroSyncAllPaymentsObj.getOneData(data.order_id, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero payments updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroSyncAllPayments(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero payments inserted to mongo");
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


module.exports = xeroSyncAllPaymentsSchema;