
var Q = require('q');
var mongoose = require('mongoose');
var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();

const request = require('supertest');
var app = require("../app");

var moment = require("moment");
var moment_tz = require("moment");



var configs = require("../config/configs");
var helper = require("../tests/helper");
var nock = require('nock');


var mongoCredentials = configs.getMongoCredentials();


var invoiceSchema = require("../models/Invoice");


/**
 * https://remotestaff.atlassian.net/browse/ER-331
 * If the top up invoice page is open in different tab, it will both accept the payment
 *
 */

describe("Create API for fetching of Invoice status", function(){
    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            //helper.mockPath();
            done();
        });
    });

    describe("A Client access the top up page (HAPPY PATH) When The client clicks on one of the payment buttons", function(){

        it("The API will respond with success", function(done){

            this.timeout(5000);

            var all_given_creation_promises = [];

            var client = {
                id: 14076,
                fname: "Chris",
                lname: "Horsley-Wyatt",
                email: "chris@blonde-robot.com.au",
                currency: "AUD",
                apply_gst: "Y"
            };

            var personal = {
                userid: 1234,
                fname: "Andrea Jaeger",
                lname: "Sierra",
                email: "testingEmail@remotestaff.com.au"
            };

            var subcon = {
                id: 7147,
                userid: personal.userid,
                current_rate: 35.00,
                client_price: 1297.14,
                work_status: "Full-Time",
                job_designation: "Phone Support Professional (Office Based)",

            };
            var admin = {
                admin_id: 143,
                admin_fname: "Allanaire",
                admin_lname: "Tapion",
                admin_email: "allan.t@remotestaff.com.au"
            };


            var invoice_details = {
                order_id: "14076-00000021",
                pay_before_date: moment_tz("2017-06-09T23:53:26Z").toDate(),
                added_on: moment_tz("2017-06-04T23:53:26Z").toDate(),
                status: "new",
                sub_total: -500,
                apply_gst: client.apply_gst,
                gst_amount: -50,
                total_amount: -550,
                currency: client.currency,
                client_id: parseInt(client.id),
                client_fname: client.fname,
                client_lname: client.lname,
                client_email: client.email,
                type: "order",
                added_by: admin.admin_fname + " " + admin.admin_lname + ":" + admin.admin_id,
                items: [
                    {
                        subcontractors_id: subcon.id,
                        description: "Credit Note Memo",
                        job_designation: "Phone Support Professional (Office Based)",
                        item_id: 1,
                        start_date: moment_tz("2017-06-01T00:00:00Z").toDate(),
                        end_date: moment_tz("2017-06-30T23:59:59Z").toDate(),
                        unit_price: 5,
                        qty: -100,
                        item_type: "Others",
                        amount: -500
                    }
                ]
            };


            all_given_creation_promises.push(helper.createMongoObject("prod", "Invoice", invoiceSchema, invoice_details));

            Q.allSettled(all_given_creation_promises).then(function(init_results){
                console.log("all given creation done");


                request(app).get("/invoice/fetch-status?order_id=" + invoice_details.order_id)
                    .end(function(err, res) {
                        if (err) {
                            console.log(err);
                            done(err);
                        }

                        try{

                            expect(res.body.success).to.be.equal(true);
                            expect(res.body.result.status).to.be.equal("new");
                            expect(res.body.result.order_id).to.be.equal("14076-00000021");

                            done();
                        } catch(major_error){
                            console.log(major_error);
                            done(major_error);
                        }


                    });

            });


        });
    });






    describe("A Client access the top up page (HAPPY PATH) When The api is called with an invoice that does not exists", function(){

        it("The API will respond with and error", function(done){

            this.timeout(5000);

            var all_given_creation_promises = [];

            Q.allSettled(all_given_creation_promises).then(function(init_results){
                console.log("all given creation done");


                request(app).get("/invoice/fetch-status?order_id=14076-00000022")
                    .end(function(err, res) {
                        if (err) {
                            console.log(err);
                            done(err);
                        }

                        try{

                            expect(res.body.success).to.be.equal(false);
                            expect(res.body.error[0]).to.be.equal("Invoice does not exist");

                            done();
                        } catch(major_error){
                            console.log(major_error);
                            done(major_error);
                        }


                    });

            });


        });
    });



    after(function(done){
        this.timeout(30000);
        var all_destruction_promise = [];


        //delete couch
        all_destruction_promise.push(helper.revertCouchDb("client_docs"));


        //delete mongo
        all_destruction_promise.push(helper.mongoDropDb("prod"));
        all_destruction_promise.push(helper.mongoDropDb("xero"));


        //delete mysql
        all_destruction_promise.push(helper.revertAll());

        Q.allSettled(all_destruction_promise).then(function(results){
            done();
        });
    });
});
