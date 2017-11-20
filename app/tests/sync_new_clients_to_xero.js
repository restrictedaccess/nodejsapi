
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

var xero = require('xero-node');
var fs = require('fs');

var leadInfoSchema = require("../mysql/Lead_Info");
var adminSchema = require("../mysql/Admin_Info");


var clientsMongoSchema = require("../models/Client");
var xeroContactSchema = require("../models/XeroContact");


/**
 * ER-101 As an Accounts I want to optimize Xero so that it will be synced with RS Invoice Management System
 *
 */

describe("System syncs clients to xero.com as contacts", function(){

    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            helper.mockPath();
            done();
        });
    });


    //Scenario 1
    describe("Lead becomes a client with at least 1 subcontractor (Happy Path)", function(){
        it("should be saving to our system", function(done){
            this.timeout(30000);

            var mock = require('mock-require');



            var all_given_saving_promises = [];

            //Mysql Objects
            var client = {
                id: 14645,
                fname: "David",
                lname: "Imrie",
                email: "davidimrie@mcgrath.com.au",
                status: "Client",
                currency: "AUD"
            };

            var admin = {
                admin_id: 143,
                admin_fname: "Allanaire",
                admin_lname: "Tapion"
            };

            //Mongo Objects
            var client_settings = {
                client_id:parseInt(client.id),
                lead:{
                    fname:client.fname,
                    lname:client.lname,
                    email:client.email,
                    status:"Client",
                    timestamp:moment_tz().toDate(),
                    csro_id: admin.admin_id
                },
                currency:client.currency,
                apply_gst:client.apply_gst,
                client_doc:{
                    client_id: parseInt(client.id),
                    days_before_suspension:-30,
                    autodebit:"N",
                    days_before_invoice:5,
                    days_to_invoice:22,
                    send_invoice_reminder:"N"
                }
            };


            //Mysql Saving
            all_given_saving_promises.push(helper.createSqlObject(leadInfoSchema, client));
            all_given_saving_promises.push(helper.createSqlObject(adminSchema, admin));


            //Mongo Saving
            all_given_saving_promises.push(helper.createMongoObject("prod", "Client", clientsMongoSchema, client_settings));



            mock('xero-node', {
                PrivateApplication: function() {
                    var xeroClient = {
                        core: {
                            contacts: {
                                newContact: function(){
                                    var newContact = {
                                        save: function(){
                                            var defered = Q.defer();
                                            var promise = defered.promise;

                                            defered.resolve({
                                                entities: [
                                                    {
                                                        toJSON: function(){
                                                            return {
                                                                ContactNumber: client.id.toString(),
                                                                AccountNumber: client_settings.lead.fname.charAt(0) + client_settings.lead.lname.charAt(0) + "-" + client.id.toString(),
                                                                ContactStatus: "ACTIVE",
                                                                Name: client_settings.lead.fname + " " + client_settings.lead.lname,
                                                                FirstName: client_settings.lead.fname,
                                                                LastName: client_settings.lead.lname,
                                                                EmailAddress: client_settings.lead.email,
                                                                DefaultCurrency: client_settings.currency
                                                            }
                                                        }

                                                    }
                                                ]
                                            });

                                            return promise;
                                        }
                                    };

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

                xero_bull.processPerClient(
                    {
                        data: {
                            processClient: {
                                id: client.id
                            }
                        }
                    },
                    function(error, response){

                        if(error) done(error);


                        var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");
                        var XeroContactModel = db_xero.model("XeroContact", xeroContactSchema);
                        var xeroContactObj = new XeroContactModel();

                        db_xero.once("open", function(){
                            db_xero.close();
                        });

                        xeroContactObj.getOneData(client.id, true).then(function(synced_client){

                            try{
                                expect(synced_client.ContactNumber).to.be.equal("14645");
                                expect(synced_client.AccountNumber).to.be.equal("DI-14645");
                                expect(synced_client.ContactStatus).to.be.equal("ACTIVE");
                                expect(synced_client.Name).to.be.equal("David Imrie");
                                expect(synced_client.FirstName).to.be.equal("David");
                                expect(synced_client.LastName).to.be.equal("Imrie");
                                expect(synced_client.EmailAddress).to.be.equal("davidimrie@mcgrath.com.au");
                                expect(synced_client.DefaultCurrency).to.be.equal("AUD");

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


        var mysql_destroy_promise = helper.revertAll();
        all_destruction_promises.push(mysql_destroy_promise);

        Q.allSettled(all_destruction_promises).then(function(results){
            done();
        });

    });
});
