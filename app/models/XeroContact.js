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
    ContactID:{type:String},
    ContactNumber : String,
    AccountNumber : String,
    ContactStatus : String,
    FirstName : String,
    LastName : String,
    Name : String,
    EmailAddress : String,
    DefaultCurrency : String,
    Addresses : Array,
    Phones : Array,
    IsSupplier : Boolean,
    IsCustomer : Boolean,
};


var xeroContactsSchema = new Schema(fields,
    {collection:"contacts"});


xeroContactsSchema.methods.getAllData = function(isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContact = db.model("XeroContact", xeroContactsSchema);

    db.once("open", function(){
        var query = XeroContact.find({}).sort({ContactNumber: -1});

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


xeroContactsSchema.methods.getOneData = function(client_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroContact = db.model("XeroContact", xeroContactsSchema);

    db.once("open", function(){
        var query = XeroContact.findOne({
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

xeroContactsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroContact = db.model("XeroContact", xeroContactsSchema);


        function updateMongoDoc(data, callback){
            XeroContact.update({ContactNumber: data.ContactNumber}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroContactObj = new XeroContact(data);


            XeroContactObj.getOneData(data.ContactNumber, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero contact updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroContact(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero contact inserted to mongo");
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


module.exports = xeroContactsSchema;