var express = require('express');
var configs = require("../../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var moment = require('moment');


var mongoCredentials = configs.getMongoCredentials();



module.exports = {
    processBatchClients: function(job, done){
        try{
            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);

            var xeroContactsToSyncSchema = require("../../models/XeroContactsToSync");
            var xeroContactSchema = require("../../models/XeroContact");
            var xeroContactsErrorsSchema = require("../../models/XeroContactErrors");

            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
            var XeroContactsToSyncModel = db.model("XeroContactsToSync", xeroContactsToSyncSchema);
            var XeroContactModel = db.model("XeroContact", xeroContactSchema);
            var XeroContactErrorsModel = db.model("XeroContactErrors", xeroContactsErrorsSchema);

            var xeroContactToSyncObj = new XeroContactsToSyncModel();
            var xeroContactObj = new XeroContactModel();
            var xeroContactErrorsObj = new XeroContactErrorsModel();

            db.once("open", function(){
                db.close();
                console.log("Fetching all batched Clients to sync");
            });

            xeroContactToSyncObj.getAllData(true).then(function(batch_contacts){
                xeroContactToSyncObj.cleareAllData();

                var contacts = [];

                for(var i = 0;i < batch_contacts.length;i++){

                    var current_contact = batch_contacts[i];

                    try{
                        delete current_contact["_id"];
                        delete current_contact["__v"];
                    } catch(deleting_error){
                        console.log(deleting_error);
                    }

                    contacts.push(xeroClient.core.contacts.newContact(current_contact));

                }

                if(contacts.length > 0){

                    xeroClient.core.contacts.saveContacts(contacts, {method: "post"})
                        .then(function(created_contacts) {
                            console.log("Contacts have been created");

                            var allSavingMongoPromises = [];

                            function saveToMongo(saved_contact_data){
                                var defer = Q.defer();
                                var promise = defer.promise;

                                var current_contact_to_mongo = saved_contact_data.toJSON();

                                xeroContactObj.saveData(current_contact_to_mongo).then(function(saving_result){
                                    defer.resolve(saving_result);
                                });

                                return promise;
                            }

                            for(var i = 0;i < created_contacts.entities.length;i++){
                                allSavingMongoPromises.push(saveToMongo(created_contacts.entities[i]));
                            }

                            Q.allSettled(allSavingMongoPromises).then(function(results){
                                done(null, results);
                            });


                        })
                        .catch(function(err) {
                            //Some error occurred

                            console.log(err.toString());
                            var data_to_save = {
                                ContactNumber: "batch_saving_error",
                                ErrorMessage: err.toString(),
                                DateCreated: configs.getDateToday()
                            };


                            xeroContactErrorsObj.saveData(data_to_save).then(function(saving_result){
                                done(err, null);
                            });
                        });
                } else{
                    console.log("No clients to sync");
                    done(null, {success:true, result: "No Clients to sync"});
                }



            });




        } catch(ultimate_error){
            console.log(ultimate_error);
            done(ultimate_error, null);
        }
    },
    processPerClient: function (job, done) {
        try{

            var xero = require('xero-node');
            var path = require('path');
            var fs = require('fs');

            var xero_keys_path = path.join(__dirname, '..', "..", "xero");

            var xeroconfig = configs.getXeroPrivateCredentials();
            if (xeroconfig.privateKeyName && !xeroconfig.privateKey)
                xeroconfig.privateKey = fs.readFileSync(xero_keys_path + "/" + xeroconfig.privateKeyName);

            var xeroClient = new xero.PrivateApplication(xeroconfig);

            if(!job.data.processClient){
                console.log("id field is required!");
                done("id field is required!", null);
            }

            var client = job.data.processClient;

            console.log(job.data);

            //if batch
            var save_batch = false;
            if(typeof job.data.isBatch != "undefined"){
                console.log("batch saving");
                save_batch = job.data.isBatch;
            }


            if(isNaN(client.id) || !client.id || client.id == ""){
                console.log(client);
                console.log("client.id must be a valid number");
                done(["client.id must be a valid number"], null);
                return true;
            }

            var client_id = client.id;

            console.log("Processing per client " + client_id);


            //fetch from client_settings mongo
            var clientsSchema = require("../../models/Client");
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var ClientModel = db.model("Client", clientsSchema);


            var xeroContactSchema = require("../../models/XeroContact");
            var xeroContactErrorsSchema = require("../../models/XeroContactErrors");
            var xeroContactsToSyncSchema = require("../../models/XeroContactsToSync");

            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");

            var XeroContactModel = db_xero.model("XeroContact", xeroContactSchema);
            var XeroContactErrorsModel = db_xero.model("XeroContactErrors", xeroContactErrorsSchema);
            var XeroContactsToSyncModel = db_xero.model("XeroContactsToSync", xeroContactsToSyncSchema);

            var xeroContactObj = new XeroContactModel();
            var xeroContactErrorsObj = new XeroContactErrorsModel();
            var xeroContactsToSyncObj = new XeroContactsToSyncModel();

            db_xero.once("open", function(){
                db_xero.close();
            });



            db.once("open", function(){

                ClientModel.findOne({client_id:parseInt(client_id)}).lean().exec(function(err, foundDoc){
                    db.close();
                    if(err){
                        console.log(err);
                        done(err, null);
                        //return res.status(200).send({success: false, errors: [err]});
                    }
                    if(foundDoc){

                        try{


                            xeroContactObj.getOneData(client_id, true, {_id: 0}).then(function(foundContact){
                                try{

                                    var data_to_sync = {
                                        ContactNumber: client_id.toString(),
                                        AccountNumber: foundDoc.lead.fname.charAt(0) + foundDoc.lead.lname.charAt(0) + "-" + client_id.toString(),
                                        ContactStatus: "ACTIVE",
                                        Name: foundDoc.lead.fname + " " + foundDoc.lead.lname,
                                        FirstName: foundDoc.lead.fname,
                                        LastName: foundDoc.lead.lname,
                                        EmailAddress: foundDoc.lead.email,
                                        DefaultCurrency: foundDoc.currency
                                    };
                                    if(foundContact){
                                        //update xero
                                        data_to_sync.ContactID = foundContact.ContactID;
                                    }


                                    if(!save_batch){

                                        var contactObj = xeroClient.core.contacts.newContact(data_to_sync);

                                        var saving_obj = contactObj.save();

                                        saving_obj.then(function(contacts) {
                                            //Contact has been created
                                            console.log("contact created in xero");
                                            var current_contact = contacts.entities[0].toJSON();
                                            console.log(current_contact);

                                            xeroContactObj.saveData(current_contact).then(function(saving_result){
                                                done(null, {success: true, result:current_contact});
                                            });

                                        }).catch(function(err) {
                                            //Some error occurred
                                            //save error
                                            console.log(err.toString());
                                            var data_to_save = {
                                                ContactNumber: client_id.toString(),
                                                ErrorMessage: err.toString(),
                                                DateCreated: configs.getDateToday()
                                            };


                                            xeroContactErrorsObj.saveData(data_to_save).then(function(saving_result){
                                                done(err, null);
                                            });


                                        });
                                    } else{
                                        //save as batch
                                        xeroContactsToSyncObj.saveData(data_to_sync).then(function(saving_result){
                                            console.log("batch saved");
                                            done(null, {success: true, result:data_to_sync, isBatch: save_batch});
                                        });
                                    }

                                } catch(major_error){
                                    console.log(major_error);
                                    done(major_error, null);
                                }

                            });


                        } catch(major_error){
                            console.log(major_error);
                            done(major_error, null);
                        }


                    } else{
                        done(["Client does not have client_settings info"], null);
                    }
                });


            });

        } catch(error){
            console.log(error);
        }

    }
};
