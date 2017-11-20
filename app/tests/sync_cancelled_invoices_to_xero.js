
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

var invoiceSchema = require("../models/Invoice");
var clientsMongoSchema = require("../models/Client");
var subcontractorsReportingSchema = require("../models/Subcontractor");
var xeroCreditNotesSchema = require("../models/XeroCreditNote");
var xeroContactSchema = require("../models/XeroContact");
var xeroInvoiceSchema = require("../models/XeroInvoice");

/**
 * ER-101 As an Accounts I want to optimize Xero so that it will be synced with RS Invoice Management System
 *
 */

describe("System syncs cancelled invoices to xero.com as Voided Invoice", function(){
    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            helper.mockPath();
            done();
        });
    });


    describe("An admin cancells an invoice [Happy Path] When The invoice is saved in our system", function(){

        it("Xero client will save invoice as voided Invoice", function(done){
            this.timeout(30000);


            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var invoiceSchema = require("../models/Invoice");

            var InvoiceModel = db.model("Invoice", invoiceSchema);

            db.once("open", function(){

                //create given
                var all_given_creation_promises = [];


                //Mysql saving
                var client = {
                    id: 14076,
                    fname: "Chris",
                    lname: "Horsley-Wyatt",
                    email: "chris@blonde-robot.com.au",
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
                    fname: "Veronica Ann",
                    lname: "Reyes",
                    email: "testingEmail@remotestaff.com.au"
                };

                var subcon = {
                    id: 7405,
                    userid: personal.userid,
                    current_rate: 36.00,
                    client_price: 1154.44,
                    work_status: "Full-Time",
                    job_designation: "Back-Office Adminstrator",

                };

                var subcon_client_rate_2 = {
                    id: 5852,
                    subcontractors_id: subcon.id,
                    start_date: moment_tz("2011-06-02T19:55:09Z").toDate(),
                    end_date: null,
                    rate: subcon.client_price,
                    work_status: "Full-Time",
                };

                var currency_adjustments_regular_invoicing = {
                    currency: "AUD",
                    rate: 37.00,
                    effective_month: 6,
                    effective_year: 2017,
                };



                //Mongo Objects
                var client_settings = {
                    client_id: parseInt(client.id),
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

                var invoice_details = {
                    order_id: "14076-00000006",
                    pay_before_date: moment_tz("2017-06-09T23:53:26Z").toDate(),
                    added_on: moment_tz("2017-06-04T23:53:26Z").toDate(),
                    date_cancelled: moment_tz("2017-06-21T05:43:16Z"),
                    status: "cancelled",
                    sub_total: 1140.3,
                    apply_gst: client.apply_gst,
                    gst_amount: 114.03,
                    total_amount: 1254.33,
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
                            description: "Veronica Ann Reyes [Back-Office Adminstrator]",
                            job_designation: "Back-Office Adminstrator",
                            item_id: 1,
                            start_date: moment_tz("2017-06-01T00:00:00Z").toDate(),
                            end_date: moment_tz("2017-06-30T23:59:59Z").toDate(),
                            unit_price: 6.66,
                            qty: 177,
                            item_type: "Regular Rostered Hours",
                            amount: 1178.82
                        },
                        {
                            subcontractors_id: subcon.id,
                            description: "Currency Adjustment (Contract Rate 1 AUD = 36.00 PESO vs. Current Rate 1 AUD = 37.00 PESO, Currency Difference of -1.00 PESO for your staff Veronica Ann Reyes [Back-Office Adminstrator])",
                            job_designation: "Back-Office Adminstrator",
                            item_id: 2,
                            start_date: moment_tz("2017-06-01T00:00:00Z").toDate(),
                            end_date: moment_tz("2017-06-30T23:59:59Z").toDate(),
                            unit_price: -0.18,
                            qty: 177,
                            item_type: "Currency Adjustment",
                            amount: -31.86
                        },
                    ]
                };

                var xero_contact_details = {
                    ContactID: "bf3108db-c4fd-4f82-ac0c-77c54592a697",
                    ContactNumber: client.id.toString()
                };

                var xero_invoice_details = {
                    InvoiceID: "9e33eaef-84bc-42d4-91a2-2a3549aacc40",
                    InvoiceNumber: invoice_details.order_id,
                    Status: "AUTHORISED"
                }


                //Mysl saving
                all_given_creation_promises.push(helper.createSqlObject(leadsSchema, client));
                all_given_creation_promises.push(helper.createSqlObject(adminSchema, admin));
                all_given_creation_promises.push(helper.createSqlObject(personalSchema, personal));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsSchema, subcon));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_2));
                all_given_creation_promises.push(helper.createSqlObject(currencyAdjustmentRegularInvoicingSchema, currency_adjustments_regular_invoicing));


                //Mongo saving
                all_given_creation_promises.push(helper.createMongoObject("prod", "Client", clientsMongoSchema, client_settings));
                all_given_creation_promises.push(helper.createMongoObject("prod", "Subcontractor", subcontractorsReportingSchema, subcontractors_reporting));
                all_given_creation_promises.push(helper.createMongoObject("prod", "Invoice", invoiceSchema, invoice_details));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, xero_contact_details));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroInvoice", xeroInvoiceSchema, xero_invoice_details));


                var mock = require('mock-require');
                mock('xero-node', {
                    PrivateApplication: function() {
                        var xeroClient = {
                            core: {
                                invoices: {
                                    newInvoice: function(){
                                        var newInvoice = {
                                            save: function(){
                                                var defered = Q.defer();
                                                var promise = defered.promise;

                                                defered.resolve({
                                                    entities: [
                                                        {
                                                            toJSON: function(){

                                                                var data_to_return =
                                                                    {
                                                                        InvoiceNumber: '14076-00000006',
                                                                        Status: 'VOIDED',
                                                                    };

                                                                return data_to_return;

                                                            }

                                                        }
                                                    ]
                                                });

                                                return promise;
                                            }
                                        };

                                        return newInvoice;

                                    }
                                }
                            }
                        };
                        return xeroClient;
                    }
                });

                var xero_bull = require("../bull/xero/invoice");

                Q.allSettled(all_given_creation_promises).then(function(results){
                    console.log("all given creation done");
                    xero_bull.processPerInvoice(
                        {
                            data: {
                                processInvoice: {
                                    order_id: invoice_details.order_id
                                }
                            }
                        },
                        function(err, response){
                            if(err) {
                                done(err);
                            }

                            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");


                            var XeroInvoiceModel = db_xero.model("XeroInvoice", xeroInvoiceSchema);
                            var xeroInvoiceObj = new XeroInvoiceModel();


                            db_xero.once("open", function(){
                                db_xero.close();
                            });



                            xeroInvoiceObj.getOneData(invoice_details.order_id, true).then(function(voided_invoice){
                                try{
                                    expect(voided_invoice.InvoiceNumber).to.be.equal("14076-00000006");
                                    expect(voided_invoice.Status).to.be.equal("VOIDED");


                                    done();
                                } catch(expectation_error){
                                    console.log(expectation_error);
                                    done(expectation_error);
                                }
                            });


                        }
                    )

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