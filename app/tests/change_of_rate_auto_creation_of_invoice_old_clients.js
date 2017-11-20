
var Q = require('q');
var mongoose = require('mongoose');
var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();
chai.use(require('chai-datetime'));

const request = require('supertest');
var app = require("../app");

var moment = require("moment");
var moment_tz = require('moment-timezone');

var configs = require("../config/configs");
var helper = require("../tests/helper");
var nock = require('nock');


var mongoCredentials = configs.getMongoCredentials();

var leadsSchema = require("../mysql/Lead_Info");
var adminSchema = require("../mysql/Admin_Info");
var subcontractorsSchema = require("../mysql/Subcontractors");
var personalSchema = require("../mysql/Personal_Info");
var subcontractorsClienRateSchema = require("../mysql/SubcontractorsClienRate");
var currencyAdjustmentRegularInvoicingSchema = require("../mysql/CurrencyAdjustmentRegularInvoicing");
var timesheetSchema = require("../mysql/Timesheet");
var timesheetDetailsSchema = require("../mysql/TimeSheetDetails");

var clientsMongoSchema = require("../models/Client");
var subcontractorsReportingSchema = require("../models/Subcontractor");

/**
 * EBRFO-31 This is to auto-create invoices for old clients
 *
 */

describe("Auto Creation of Invoice for Old Client", function(){
    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            done();
        });
    });


    //Scenario 3
    describe("Invoice created with subcontractors change of rate", function(){

        it("should be saving to our system", function(done){
            this.timeout(30000);

            var invoice_auto_creation_process = require("../bull/invoice_auto-creation");

            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var invoiceSchema = require("../models/Invoice");

            var InvoiceModel = db.model("Invoice", invoiceSchema);

            db.once("open", function(){

                //create given
                var all_given_creation_promises = [];


                //Mysql saving
                var client = {
                    id: 6071,
                    fname: "Mark",
                    lname: "Liddle",
                    email: "mark.liddle@itmildura.com.au",
                    currency: "AUD",
                    apply_gst: "Y"
                };

                var admin = {
                    admin_id: 143,
                    admin_fname: "Allanaire",
                    admin_lname: "Tapion",
                    admin_email: "allan.t@remotestaff.com.au"
                };

                var personal = {
                    userid: 1234,
                    fname: "Efigenio IV",
                    lname: "Rodriguez",
                    email: "testingEmail@remotestaff.com.au"
                };

                var subcon = {
                    id: 2708,
                    userid: personal.userid,
                    current_rate: 38.00,
                    client_price: 1624.13,
                    work_status: "Full-Time",
                    job_designation: "Full Time – Front End Developer",

                };

                var subcon_client_rate_1 = {
                    id: 5851,
                    subcontractors_id: subcon.id,
                    start_date: moment_tz("2011-07-04T00:00:00Z").toDate(),
                    end_date: moment_tz("2017-06-02T19:55:09Z").toDate(),
                    rate: 1450.00,
                    work_status: "Full-Time",
                };

                var subcon_client_rate_2 = {
                    id: 5852,
                    subcontractors_id: subcon.id,
                    start_date: moment_tz("2017-06-02T19:55:09Z").toDate(),
                    end_date: null,
                    rate: 1624.13,
                    work_status: "Full-Time",
                };

                var currency_adjustments_regular_invoicing = {
                    currency: "AUD",
                    rate: 37.5,
                    effective_month: 5,
                    effective_year: 2017,
                };


                //timesheets
                var timesheet_may = {
                    id: 50314,
                    leads_id : client.id,
                    userid : personal.userid,
                    subcontractors_id : subcon.id,
                    month_year: moment_tz("2017-05-01T00:00:00Z").toDate(),
                    date_generated: moment_tz("2017-05-03T12:53:26Z").toDate(),
                    status: "open",
                    notify_staff_invoice_generator: "N",
                    notify_client_invoice_generator: "Y",
                };

                var timesheet_june = {
                    id: 50998,
                    leads_id : client.id,
                    userid : personal.userid,
                    subcontractors_id : subcon.id,
                    month_year: moment_tz("2017-06-01T00:00:00Z").toDate(),
                    date_generated: moment_tz("2017-06-03T12:53:26Z").toDate(),
                    status: "open",
                    notify_staff_invoice_generator: "Y",
                    notify_client_invoice_generator: "Y",
                };



                //Mongo Objects
                var client_settings = {
                    client_id:client.id,
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

                var subcontractors_reporting = {
                    subcontractors_id:parseInt(subcon.id),
                    userid:parseInt(personal.userid),
                    personal_detail:{
                        fname:personal.fname,
                        lname:personal.lname,
                        email:personal.email
                    },
                    subcontractors_detail:{
                        client_price:parseFloat(subcon.client_price),
                        status:"ACTIVE",
                        work_status:subcon.work_status,
                        job_designation:subcon.job_designation,
                        current_rate:subcon.current_rate,
                        client_change_rate:[
                            {
                                id: subcon_client_rate_1.id.toString(),
                                subcontractors_id: subcon.id.toString(),
                                start_date: "2011-07-04 00:00:00",
                                end_date: "2017-06-02 19:55:09",
                                rate: subcon_client_rate_1.rate.toString(),
                                work_status: subcon_client_rate_1.work_status,
                                date_added: null
                            },
                            {
                                id: subcon_client_rate_2.id.toString(),
                                subcontractors_id: subcon.id.toString(),
                                start_date: "2017-06-02 19:55:09",
                                end_date: null,
                                rate: subcon_client_rate_2.rate.toString(),
                                work_status: subcon_client_rate_2.work_status,
                                date_added: null
                            },
                        ],
                        starting_date:moment_tz().toDate(),
                        posting_id:5 //(random)
                    },
                    leads_detail:{
                        id:parseInt(client.id),
                        fname:client.fname,
                        lname:client.lname
                    },
                };


                //Mysl saving
                all_given_creation_promises.push(helper.createSqlObject(leadsSchema, client));
                all_given_creation_promises.push(helper.createSqlObject(adminSchema, admin));
                all_given_creation_promises.push(helper.createSqlObject(personalSchema, personal));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsSchema, subcon));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_1));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_2));
                all_given_creation_promises.push(helper.createSqlObject(currencyAdjustmentRegularInvoicingSchema, currency_adjustments_regular_invoicing));
                all_given_creation_promises.push(helper.generate_timesheet(timesheet_may, "locked", 184, 8.00));
                all_given_creation_promises.push(helper.generate_timesheet(timesheet_june, "locked", 176, 8.00));


                //Mongo saving
                all_given_creation_promises.push(helper.createMongoObject("prod", "Client", clientsMongoSchema, client_settings));
                all_given_creation_promises.push(helper.createMongoObject("prod", "Subcontractor", subcontractorsReportingSchema, subcontractors_reporting));


                Q.allSettled(all_given_creation_promises).then(function(results){
                    console.log("all given creation done");

                    invoice_auto_creation_process.invoiceCreationQueue({data:{client_id:6071}}, function(err, result){
                        console.log(err);
                        console.log(result);

                        InvoiceModel.findOne({}).exec(function(err, createdInvoice){
                            try{
                                expect(createdInvoice).to.have.property("items");
                                expect(createdInvoice.items).to.have.lengthOf(3);

                                expect(createdInvoice.order_id).to.equal("6071-00000001");
                                // expect(createdInvoice.added_on).to.equalDate(moment.utc("2017-06-04T00:00:00Z").toDate());
                                expect(createdInvoice.pay_before_date).to.equalDate(moment.utc("2017-06-08T16:00:00Z").toDate());
                                expect(createdInvoice.type).to.equal("order");
                                expect(createdInvoice.payment_advise).to.equal(false);
                                expect(createdInvoice.apply_gst).to.equal("Y");
                                expect(createdInvoice.currency).to.equal("AUD");
                                expect(createdInvoice.status).to.equal("new");
                                expect(createdInvoice.sub_total).to.equal(1669.36);
                                expect(createdInvoice.gst_amount).to.equal(166.94);
                                expect(createdInvoice.total_amount).to.equal(1836.3);


                                //test first item:
                                var first_item = createdInvoice.items[0];
                                expect(first_item.current_rate).to.equal(38);
                                expect(first_item.description).to.equal("Efigenio IV Rodriguez [Full Time – Front End Developer]");
                                expect(first_item.start_date).to.equalDate(moment.utc("2017-06-01T00:00.00Z").toDate());
                                expect(first_item.end_date).to.equalDate(moment.utc("2017-06-30T00:00.00Z").toDate());
                                expect(first_item.item_type).to.equal("Regular Rostered Hours");
                                expect(first_item.job_designation).to.equal("Full Time – Front End Developer");
                                expect(first_item.qty).to.equal(176);
                                expect(first_item.unit_price).to.equal(9.37);
                                expect(first_item.amount).to.equal(1649.12);
                                expect(first_item.subcontractors_id).to.equal(2708);



                                var second_item = createdInvoice.items[1];
                                expect(second_item.current_rate).to.equal(38);
                                expect(second_item.description).to.equal("Efigenio IV Rodriguez [Full Time – Front End Developer] (May Overtime) Adjustment Over Time Work");
                                expect(second_item.start_date).to.equalDate(moment.utc("2017-05-01T00:00.00Z").toDate());
                                expect(second_item.end_date).to.equalDate(moment.utc("2017-05-31T00:00.00Z").toDate());
                                expect(second_item.item_type).to.equal("Adjustment Over Time Work");
                                expect(second_item.job_designation).to.equal("Full Time – Front End Developer");
                                expect(second_item.qty).to.equal(0);
                                expect(second_item.unit_price).to.equal(9.37);
                                expect(second_item.amount).to.equal(0);
                                expect(second_item.subcontractors_id).to.equal(2708);



                                var third_item = createdInvoice.items[2];
                                expect(third_item.current_rate).to.equal(38);
                                expect(third_item.description).to.equal("Currency Adjustment (Contract Rate 1 AUD = 38 PESO VS Current Rate 1 AUD = 37.5 PESO, Currency Difference of 0.5  PESO for your staff Efigenio IV Rodriguez)(Actual Working Hours of 184 from May 1, 2017 to May 31, 2017)(Hourly Rate 8.37)/Current Rate 37.5");
                                expect(third_item.start_date).to.equalDate(moment.utc("2017-05-01T00:00.00Z").toDate());
                                expect(third_item.end_date).to.equalDate(moment.utc("2017-05-31T00:00.00Z").toDate());
                                expect(third_item.item_type).to.equal("Currency Adjustment");
                                expect(third_item.job_designation).to.equal("Full Time – Front End Developer");
                                expect(third_item.qty).to.equal(184);
                                expect(third_item.unit_price).to.equal(0.11);
                                expect(third_item.amount).to.equal(20.24);
                                expect(third_item.subcontractors_id).to.equal(2708);

                                done();
                            } catch(error){
                                done(error);
                            }



                        });

                    });
                });
            });

        });
    });


    after(function(done){
        this.timeout(30000);
        var all_destruction_promise = [];

        var deferDropMongo = Q.defer();
        var promiseDropMongo = deferDropMongo.promise;
        all_destruction_promise.push(promiseDropMongo);


        var deferDropMysql = Q.defer();
        var promiseDropMysql = deferDropMysql.promise;
        all_destruction_promise.push(promiseDropMysql);


        //delete couch
        all_destruction_promise.push(helper.revertCouchDb("client_docs"));


        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");

        db.once("open", function(){
            db.db.dropDatabase(function(err, result) {
                console.log(err);
                console.log(result);
                deferDropMongo.resolve(result);
            });
        });


        helper.revertAll().then(function(stdout){
            deferDropMysql.resolve(stdout);
        });


        Q.allSettled(all_destruction_promise).then(function(results){
            done();
        });
    });
});
