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
    ContactNumber : String,
    ErrorMessage: Schema.Types.Mixed,
    DateCreated: Date
};


var xeroContactsErrorsSchema = new Schema(fields,
    {collection:"contact_errors"});


xeroContactsErrorsSchema.methods.getOneData = function(client_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContactErrors = db.model("XeroContactErrors", xeroContactsErrorsSchema);

    db.once("open", function(){
        var query = XeroContactErrors.findOne({
            ContactNumber: client_id
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

xeroContactsErrorsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroContact = db.model("XeroContact", xeroContactsErrorsSchema);


        function updateMongoDoc(data, callback){
            XeroContact.update({ContactNumber: data.ContactNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroContactObj = new XeroContact(data);


            //insert
            foundDoc = new XeroContact(data);

            foundDoc.save(function(err){
                db.close();
                if (err){
                    console.log(err);
                    willDefer.resolve(null);
                }
                console.log("xero contact ERROR inserted to mongo");
                willDefer.resolve(foundDoc);
            });
        });

    } catch(major_error){
        consol.log(major_error);
        willDefer.resolve(null);
    }

    return willFullfill;

}


module.exports = xeroContactsErrorsSchema;