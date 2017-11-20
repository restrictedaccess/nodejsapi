var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
    client_id:{type:Number},
    date_synced : Date,
};


var xeroSyncAllClientsSchema = new Schema(fields,
    {collection:"xero_sync_all_clients"});


xeroSyncAllClientsSchema.methods.getAllData = function(isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllClients = db.model("XeroSyncAllClients", xeroSyncAllClientsSchema);

    db.once("open", function(){
        var query = XeroSyncAllClients.find({}).sort({client_id: -1});

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


xeroSyncAllClientsSchema.methods.getOneData = function(client_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
    var XeroSyncAllClients = db.model("XeroSyncAllClients", xeroSyncAllClientsSchema);

    db.once("open", function(){
        var query = XeroSyncAllClients.findOne({
            client_id: parseInt(client_id)
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

xeroSyncAllClientsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
        var XeroSyncAllClients = db.model("XeroSyncAllClients", xeroSyncAllClientsSchema);


        function updateMongoDoc(data, callback){
            XeroSyncAllClients.update({client_id: parseInt(data.client_id)}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var XeroSyncAllClientsObj = new XeroSyncAllClients(data);


            XeroSyncAllClientsObj.getOneData(data.client_id, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("xero client updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new XeroSyncAllClients(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("xero client inserted to mongo");
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


module.exports = xeroSyncAllClientsSchema;