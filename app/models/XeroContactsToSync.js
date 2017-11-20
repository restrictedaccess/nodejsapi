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
    ContactID: String,
    ContactNumber: String,
    AccountNumber: String,
    ContactStatus: String,
    Name: String,
    FirstName: String,
    LastName: String,
    EmailAddress: String,
    DefaultCurrency: String
};


var xeroContactsToSyncSchema = new Schema(fields,
    {collection:"xero_contacts_to_sync"});



xeroContactsToSyncSchema.methods.cleareAllData = function(){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContactsToSync = db.model("XeroContactsToSync", xeroContactsToSyncSchema);

    db.once("open", function(){
        XeroContactsToSync.remove({}, function (err) {
            db.close();
            if (err) {
                console.log(err);
                willDefer.resolve(null);
            }
            // removed!
            console.log("xero_contacts_to_sync cleared!");
            willDefer.resolve({success:true});
        });
    });


    return willFullfill;
};

xeroContactsToSyncSchema.methods.getAllData = function(isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContactsToSync = db.model("XeroContactsToSync", xeroContactsToSyncSchema);

    db.once("open", function(){
        var query = XeroContactsToSync.find({}).sort({ContactNumber: -1});

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDocs){
            db.close();
            willDefer.resolve(foundDocs);
        });
    });

    return willFullfill;
};


xeroContactsToSyncSchema.methods.getOneData = function(client_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContactsToSync = db.model("XeroContactsToSync", xeroContactsToSyncSchema);

    db.once("open", function(){
        var query = XeroContactsToSync.findOne({
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

xeroContactsToSyncSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroContactsToSync = db.model("XeroContactsToSync", xeroContactsToSyncSchema);


        function updateMongoDoc(data, callback){
            XeroContactsToSync.update({ContactNumber: data.ContactNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroContactObj = new XeroContactsToSync(data);


            XeroContactObj.getOneData(data.ContactNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero contact BATCH updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroContactsToSync(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero contact BATCH inserted to mongo");
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


module.exports = xeroContactsToSyncSchema;