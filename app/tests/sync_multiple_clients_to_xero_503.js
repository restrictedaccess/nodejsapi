
var Q = require('q');
var mongoose = require('mongoose');
var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();

const request = require('supertest');
var app = require("../app");

var moment = require("moment");
var moment_tz = require('moment-timezone');



var configs = require("../config/configs");
var helper = require("../tests/helper");
var nock = require('nock');

var mongoCredentials = configs.getMongoCredentials();


var leadInfoSchema = require("../mysql/Lead_Info");
var adminSchema = require("../mysql/Admin_Info");


var clientsMongoSchema = require("../models/Client");
var xeroContactSchema = require("../models/XeroContact");
var xeroContactsErrorsSchema = require("../models/XeroContactErrors");
var xeroContactsToSyncSchema = require("../models/XeroContactsToSync");


/**
 * ER-101 As an Accounts I want to optimize Xero so that it will be synced with RS Invoice Management System
 *
 */

describe("System batch syncs clients to xero.com as contact every 30 seconds", function(){

    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            helper.mockPath();
            done();
        });
    });


    //Scenario 1
    describe("4 clients are updated to the system and xero responds with 503 error [Unhappy Path] When Xero Clietns responds with a 503 error code", function(){
        it("A history of the error will be recorded", function(done){
            this.timeout(30000);

            var mock = require('mock-require');



            var all_given_saving_promises = [];

            //Mysql Objects
            var client_1 = {
                id: 14645,
                fname: "David",
                lname: "Imrie",
                email: "davidimrie02@mcgrath.com.au",
                status: "Client",
                currency: "AUD"
            };

            var client_2 = {
                id: 14646,
                fname: "Huston",
                lname: "Texas",
                email: "davidimrie02@mcgrath.com.au",
                status: "Client",
                currency: "AUD"
            };

            var client_3 = {
                id: 14647,
                fname: "Marie",
                lname: "Curry",
                email: "davidimrie02@mcgrath.com.au",
                status: "Client",
                currency: "AUD"
            };

            var client_4 = {
                id: 14648,
                fname: "Stephen",
                lname: "Wallace",
                email: "davidimrie02@mcgrath.com.au",
                status: "Client",
                currency: "AUD"
            };

            var admin = {
                admin_id: 143,
                admin_fname: "Allanaire",
                admin_lname: "Tapion"
            };

            //Mongo Objects

            var existing_xero_contact_mongo_1 = {
                ContactNumber: client_1.id.toString(),
                ContactID: "33be2ffa-dc57-46ad-a688-4b66ff46c20f"
            };

            var existing_xero_contact_mongo_2 = {
                ContactNumber: client_2.id.toString(),
                ContactID: "33be2ffa-dc57-46ad-a688-4b66ff46c20a"
            };

            var existing_xero_contact_mongo_3 = {
                ContactNumber: client_3.id.toString(),
                ContactID: "33be2ffa-dc57-46ad-a688-4b66ff46c20b"
            };

            var existing_xero_contact_mongo_4 = {
                ContactNumber: client_4.id.toString(),
                ContactID: "33be2ffa-dc57-46ad-a688-4b66ff46c20c"
            };


            var client_to_sync_1 = {
                ContactID: existing_xero_contact_mongo_1.ContactID,
                ContactNumber: client_1.id.toString(),
                AccountNumber: client_1.fname.charAt(0) + client_1.lname.charAt(0) + "-" + client_1.id.toString(),
                ContactStatus: "ACTIVE",
                Name: client_1.fname + " " + client_1.lname,
                FirstName: client_1.fname,
                LastName: client_1.lname,
                EmailAddress: client_1.email,
                DefaultCurrency: client_1.currency
            };


            var client_to_sync_2 = {
                ContactID: existing_xero_contact_mongo_2.ContactID,
                ContactNumber: client_2.id.toString(),
                AccountNumber: client_2.fname.charAt(0) + client_2.lname.charAt(0) + "-" + client_2.id.toString(),
                ContactStatus: "ACTIVE",
                Name: client_2.fname + " " + client_2.lname,
                FirstName: client_2.fname,
                LastName: client_2.lname,
                EmailAddress: client_2.email,
                DefaultCurrency: client_2.currency
            };


            var client_to_sync_3 = {
                ContactID: existing_xero_contact_mongo_3.ContactID,
                ContactNumber: client_3.id.toString(),
                AccountNumber: client_3.fname.charAt(0) + client_3.lname.charAt(0) + "-" + client_3.id.toString(),
                ContactStatus: "ACTIVE",
                Name: client_3.fname + " " + client_3.lname,
                FirstName: client_3.fname,
                LastName: client_3.lname,
                EmailAddress: client_3.email,
                DefaultCurrency: client_3.currency
            };


            var client_to_sync_4 = {
                ContactID: existing_xero_contact_mongo_4.ContactID,
                ContactNumber: client_4.id.toString(),
                AccountNumber: client_4.fname.charAt(0) + client_4.lname.charAt(0) + "-" + client_4.id.toString(),
                ContactStatus: "ACTIVE",
                Name: client_4.fname + " " + client_4.lname,
                FirstName: client_4.fname,
                LastName: client_4.lname,
                EmailAddress: client_4.email,
                DefaultCurrency: client_4.currency
            };




            //Mysql Saving
            all_given_saving_promises.push(helper.createSqlObject(leadInfoSchema, client_1));
            all_given_saving_promises.push(helper.createSqlObject(leadInfoSchema, client_2));
            all_given_saving_promises.push(helper.createSqlObject(leadInfoSchema, client_3));
            all_given_saving_promises.push(helper.createSqlObject(leadInfoSchema, client_4));
            all_given_saving_promises.push(helper.createSqlObject(adminSchema, admin));


            //Mongo Saving
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, existing_xero_contact_mongo_1));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, existing_xero_contact_mongo_2));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, existing_xero_contact_mongo_3));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, existing_xero_contact_mongo_4));

            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContactsToSync", xeroContactsToSyncSchema, client_to_sync_1));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContactsToSync", xeroContactsToSyncSchema, client_to_sync_2));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContactsToSync", xeroContactsToSyncSchema, client_to_sync_3));
            all_given_saving_promises.push(helper.createMongoObject("xero", "XeroContactsToSync", xeroContactsToSyncSchema, client_to_sync_4));


            mock('xero-node', {
                PrivateApplication: function() {
                    var xeroClient = {
                        core: {
                            contacts: {
                                saveContacts: function (contacts){
                                    var defered = Q.defer();
                                    var promise = defered.promise;

                                    function ServerUnavailableError()
                                    {

                                    }

                                    ServerUnavailableError.prototype.toString = function(){
                                        return "Server Unavailable";
                                    }


                                    defered.reject(new ServerUnavailableError());

                                    return promise;
                                },
                                newContact: function(current_contact){
                                    var newContact = current_contact;

                                    return newContact;

                                }
                            }
                        }
                    };
                    return xeroClient;
                }
            });

            var xero_bull = require("../bull/xero/client");


            Q.allSettled(all_given_saving_promises).then(function(results){

                xero_bull.processBatchClients({},
                    function(error, response){



                        var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
                        var XeroContactModel = db_xero.model("XeroContact", xeroContactSchema);
                        var XeroContactErrorsModel = db_xero.model("XeroContactErrors", xeroContactsErrorsSchema);
                        var XeroContactsToSyncModel = db_xero.model("XeroContactsToSync", xeroContactsToSyncSchema);

                        var xeroContactObj = new XeroContactModel();
                        var xeroContactsToSyncObj = new XeroContactsToSyncModel();
                        var xeroContactsErrorsObj = new XeroContactErrorsModel();

                        db_xero.once("open", function(){
                            db_xero.close();
                        });


                        xeroContactsErrorsObj.getOneData("batch_saving_error", true).then(function(synced_client){

                            try{
                                expect(synced_client.ContactNumber).to.be.equal("batch_saving_error");
                                expect(synced_client.ErrorMessage).to.have.string('Server Unavailable');

                                done();
                            } catch(saving_error){
                                done(saving_error);
                            }
                        });

                    }
                );

            });

        });
    });



    after(function(done){
        this.timeout(30000);
        var all_destruction_promises = [];

        all_destruction_promises.push(helper.mongoDropDb("prod"));
        all_destruction_promises.push(helper.mongoDropDb("xero"));


        var mysql_destroy_promise = helper.revertAll();
        all_destruction_promises.push(mysql_destroy_promise);

        Q.allSettled(all_destruction_promises).then(function(results){
            done();
        });

    });
});
