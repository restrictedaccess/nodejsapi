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
    InvoiceNumber : String,
    ErrorMessage: Schema.Types.Mixed,
    DateCreated: Date
};


var xeroPaymentsErrorsSchema = new Schema(fields,
    {collection:"payments_errors"});


xeroPaymentsErrorsSchema.methods.getOneData = function(order_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroPaymentsErrors = db.model("XeroPaymentsErrors", xeroPaymentsErrorsSchema);

    db.once("open", function(){
        var query = XeroPaymentsErrors.findOne({
            "InvoiceNumber": order_id
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

xeroPaymentsErrorsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroPaymentsErrors = db.model("XeroPaymentsErrors", xeroPaymentsErrorsSchema);

        db.once("open", function(){


            //insert
            foundDoc = new XeroPaymentsErrors(data);

            foundDoc.save(function(err){
                db.close();
                if (err){
                    console.log(err);
                    willDefer.resolve(null);
                }
                console.log("xero payments ERROR inserted to mongo");
                willDefer.resolve(foundDoc);
            });
        });

    } catch(major_error){
        consol.log(major_error);
        willDefer.resolve(null);
    }

    return willFullfill;

}


module.exports = xeroPaymentsErrorsSchema;