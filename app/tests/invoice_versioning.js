/**
 * Created by joenefloresca on 20/06/2017.
 */
var assert = require("assert");
var chai = require('chai'), expect = chai.expect, should = chai.should();
const request = require('supertest');
var app = require("../app");

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();
var helper = require("../tests/helper");

var invoiceModificationsSchema = require("../models/InvoiceModifications");
var invoiceVersionsSchema = require("../models/InvoiceVersions");

describe('Invoice Versioning Tests', function() {

    describe('Inserting record to invoice_modifications', function() {

        it('It should insert record to invoice_modifications', function() {

            var data = {
                invoice_number: "12607-00000018",
                date_updated: "2016-06-18",
                updated_by_admin_id: 139,
                updated_by_admin_name: "Joy Edora",
                status: "Pending"
            };

            request(app)
                .post('/invoice-versioning/sync-modification')
                .expect(200)
                .send(data)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result).to.equal("Invoice inserted");
                });
        });
    });

    describe('Inserting record to invoice_versions', function() {

        it('It should return Invoice version inserted', function() {

            var data = {
                "version" : 1,
                "added_on": "2017-06-21T01:14:06.960Z",
                "added_on_unix": 1498007646,
                "disable_auto_follow_up": "N",
                "apply_gst": "Y",
                "order_id": "12607-00000019",
                "client_email": "devs.anne.tester.devs@remotestaff.com.au",
                "client_fname": "Anne",
                "client_lname": "Devs Dummy",
                "type": "order",
                "payment_advise": false,
                "mongo_synced": true,
                "client_id": 12607,
                "pay_before_date": "2017-06-21T01:15:00.000Z",
                "pay_before_date_unix": 1498007700,
                "sub_total": 48,
                "gst_amount": 4.800000000000001,
                "total_amount": 52.8,
                "currency": "AUD",
                "added_by": "Joy Edora :380",
                "invoice_setup": "margin",
                "items": [{
                    "item_id": 1,
                    "description": "Test 1",
                    "amount": 2,
                    "unit_price": 2,
                    "qty": 1,
                    "subcontractors_id": false,
                    "item_type": "Currency Adjustment",
                    "commission_id": null
                }, {
                    "item_id": 2,
                    "description": "Test 2",
                    "amount": 34,
                    "unit_price": 34,
                    "qty": 1,
                    "subcontractors_id": false,
                    "item_type": "Reimbursement",
                    "commission_id": null
                }, {
                    "item_id": 3,
                    "description": "Test 3",
                    "amount": 4,
                    "unit_price": 4,
                    "qty": 1,
                    "subcontractors_id": false,
                    "item_type": "Final Invoice",
                    "commission_id": null
                }, {
                    "item_id": 4,
                    "description": "Test 4",
                    "amount": 5,
                    "unit_price": 5,
                    "qty": 1,
                    "subcontractors_id": false,
                    "item_type": "Office Fee",
                    "commission_id": null
                }, {
                    "item_id": 5,
                    "description": "Test 5",
                    "amount": 3,
                    "unit_price": 3,
                    "qty": 1,
                    "subcontractors_id": false,
                    "item_type": "Service Fee",
                    "commission_id": null
                }],
                "status": "new",
                "client_names": ["anne", "devs dummy"],
                "history": [{
                    "timestamp": "2017-06-21T01:15:22.354Z",
                    "changes": "Changed due date from 2017-06-21T09:15:22+08:00 to 2017-06-21T09:15:00+08:00",
                    "by": "Joy Edora :380",
                    "timestamp_unix": 1498007722
                }, {
                    "timestamp": "2017-06-21T01:15:22.355Z",
                    "changes": "Changed due date from 2017-06-21T09:15:22+08:00 to 2017-06-21T09:14:06+08:00",
                    "by": "Joy Edora :380",
                    "timestamp_unix": 1498007722
                }]
            };
            request(app)
                .post('/invoice-versioning/sync-version')
                .expect(200)
                .send(data)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result).to.equal("Invoice version inserted");
                });
        });

    });

    describe('Get latest version of a specific order_id', function() {

        it('It should return latest version of 12607-00000019', function() {

            request(app)
                .get('/invoice-versioning/get-latest-version?order_id='+"12607-00000019")
                .expect(200)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result.version).to.equal(1);
                });
        });

    });

    describe('Get client_docs versions of a specific order_id', function() {

        it('It should return all Invoice Versions of 12607-00000019', function() {
            var data = {
                "order_id" : "12607-00000019"
            };
            request(app)
                .get('/invoice-versioning/get-all-versions?order_id='+data.order_id)
                .expect(200)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result.length).to.greaterThanOrEqual(1);
                });
        });
    });

    describe('Clear all invoice modification of 12607-00000019', function() {

        it('It should return all Invoice Modifications Cleared', function() {
            var data = {
                "order_id" : "12607-00000019"
            };
            request(app)
                .get('/invoice-versioning/clear-invoice-modifications?order_id='+data.order_id)
                .expect(200)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result).to.equal("Invoice Modifications Cleared");
                });
        });
    });

    describe('Check invoice 12607-00000019 if has modification', function() {

        it('It should return true or false if invoice number has modification', function() {
            var data = {
                "order_id" : "12607-00000019"
            };
            request(app)
                .get('/invoice-versioning/has-modification?order_id='+data.order_id)
                .expect(200)
                .end(function(err, res) {
                    var msg = res.body;
                    expect(msg.result).to.be.a("boolean");
                });
        });
    });

    after(function(done){
       helper.mongoDropDb("prod").then(function(response){
          done();
       });
    });


});



