
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
var xeroInvoiceSchema = require("../models/XeroInvoice");
var xeroPaymentsErrorsSchema = require("../models/XeroPaymentErrors");
var xeroPaymentsToSyncSchema = require("../models/XeroPaymentsToSync");
var xeroContactSchema = require("../models/XeroContact");

/**
 * ER-101 As an Accounts I want to optimize Xero so that it will be synced with RS Invoice Management System
 *
 */

describe("System syncs invoices to xero.com as Invoice", function(){
    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            helper.mockPath();
            done();
        });
    });


    describe("An Invoice is created in our system (system-generated) [Happy Path] When The invoice is saved in our system", function(){

        it("Xero client will save invoice as Invoice", function(done){
            this.timeout(30000);


            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
            var invoiceSchema = require("../models/Invoice");

            var InvoiceModel = db.model("Invoice", invoiceSchema);

            db.once("open", function(){

                //create given
                var all_given_creation_promises = [];


                //Mysql saving
                var client_1 = {
                    id: 14076,
                    fname: "Chris",
                    lname: "Liddle",
                    email: "chris@blonde-robot.com.au",
                    currency: "AUD",
                    apply_gst: "Y"
                };

                var client_2 = {
                    id: 14077,
                    fname: "Ben",
                    lname: "Harold",
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

                var personal_1 = {
                    userid: 1234,
                    fname: "Veronica Ann",
                    lname: "Reyes",
                    email: "testingEmail@remotestaff.com.au"
                };

                var personal_2 = {
                    userid: 1235,
                    fname: "Vanny",
                    lname: "Cruz",
                    email: "testingEmail@remotestaff.com.au"
                };

                var subcon_1 = {
                    id: 7405,
                    userid: personal_1.userid,
                    current_rate: 36.00,
                    client_price: 1154.44,
                    work_status: "Full-Time",
                    job_designation: "Back-Office Adminstrator",

                };

                var subcon_2 = {
                    id: 7406,
                    userid: personal_2.userid,
                    current_rate: 36.00,
                    client_price: 1154.44,
                    work_status: "Full-Time",
                    job_designation: "Back-Office Adminstrator",

                };

                var subcon_client_rate_2 = {
                    id: 5852,
                    subcontractors_id: subcon_1.id,
                    start_date: moment_tz("2011-06-02T19:55:09Z").toDate(),
                    end_date: null,
                    rate: subcon_1.client_price,
                    work_status: "Full-Time",
                };


                var subcon_client_rate_3 = {
                    id: 5853,
                    subcontractors_id: subcon_2.id,
                    start_date: moment_tz("2011-06-02T19:55:09Z").toDate(),
                    end_date: null,
                    rate: subcon_2.client_price,
                    work_status: "Full-Time",
                };

                var currency_adjustments_regular_invoicing = {
                    currency: "AUD",
                    rate: 37.00,
                    effective_month: 6,
                    effective_year: 2017,
                };


                //timesheets

                var timesheet_june_1 = {
                    id: 50998,
                    leads_id : client_1.id,
                    userid : personal_1.userid,
                    subcontractors_id : subcon_1.id,
                    month_year: moment_tz("2017-06-01T00:00:00Z").toDate(),
                    date_generated: moment_tz("2017-06-03T12:53:26Z").toDate(),
                    status: "open",
                    notify_staff_invoice_generator: "Y",
                    notify_client_invoice_generator: "Y",
                };


                var timesheet_june_2 = {
                    id: 50999,
                    leads_id : client_2.id,
                    userid : personal_2.userid,
                    subcontractors_id : subcon_2.id,
                    month_year: moment_tz("2017-06-01T00:00:00Z").toDate(),
                    date_generated: moment_tz("2017-06-03T12:53:26Z").toDate(),
                    status: "open",
                    notify_staff_invoice_generator: "Y",
                    notify_client_invoice_generator: "Y",
                };



                //Mongo Objects
                var xero_contact_details_1 = {
                    ContactID: "7a48ccba-1809-466e-be8a-b2ae53e08f7c",
                    ContactNumber: client_1.id.toString()
                };

                var xero_contact_details_2 = {
                    ContactID: "7a48ccba-1809-466e-be8a-b2ae53e08f7d",
                    ContactNumber: client_2.id.toString()
                };


                var xero_invoice_1 = {
                    Contact: { ContactID: '7a48ccba-1809-466e-be8a-b2ae53e08f7c' },
                    "Type": 'ACCREC',
                    InvoiceNumber: '14076-00000006',
                    InvoiceID: "dcf0dfd0-b023-4acb-bb76-1c1f3cba3ae0",
                    Status: 'AUTHORISED',
                    DueDate: '2017-06-09',
                    LineAmountTypes: 'Exclusive',
                    CurrencyCode: 'AUD',
                    Date: '2017-06-05',
                    LineItems: [
                        {
                            TaxType: 'OUTPUT',
                            UnitAmount: 6.66,
                            Quantity: 177,
                            AccountCode: 'RRH',
                            Description: 'Veronica Ann Reyes [Back-Office Adminstrator] \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]',
                            TaxAmount: 117.88,
                            LineAmount: 1178.82
                        },
                        {
                            TaxType: '',
                            UnitAmount: -0.18,
                            Quantity: 177,
                            AccountCode: 'CUR LOS',
                            Description: 'Currency Adjustment (Contract Rate 1 AUD = 36.00 PESO vs. Current Rate 1 AUD = 37.00 PESO, Currency Difference of -1.00 PESO for your staff Veronica Ann Reyes [Back-Office Adminstrator]) \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]',
                            TaxAmount: -3.19,
                            LineAmount: -31.86
                        }
                    ],
                    AmountDue: 1254.33,
                    SubTotal: 1140.3,
                    TotalTax: 114.03,
                    Total: 1254.33,

                };



                var xero_invoice_2 = {
                    Contact: { ContactID: '7a48ccba-1809-466e-be8a-b2ae53e08f7d' },
                    "Type": 'ACCREC',
                    InvoiceNumber: '14077-00000006',
                    InvoiceID: "dcf0dfd0-b023-4acb-bb76-1c1f3cba3ae1",
                    Status: 'AUTHORISED',
                    DueDate: '2017-06-09',
                    LineAmountTypes: 'Exclusive',
                    CurrencyCode: 'AUD',
                    Date: '2017-06-05',
                    LineItems: [
                        {
                            TaxType: 'OUTPUT',
                            UnitAmount: 6.66,
                            Quantity: 177,
                            AccountCode: 'RRH',
                            Description: 'Vanny Cruz [Back-Office Adminstrator] \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]',
                            TaxAmount: 117.88,
                            LineAmount: 1178.82
                        },
                        {
                            TaxType: '',
                            UnitAmount: -0.18,
                            Quantity: 177,
                            AccountCode: 'CUR LOS',
                            Description: 'Currency Adjustment (Contract Rate 1 AUD = 36.00 PESO vs. Current Rate 1 AUD = 37.00 PESO, Currency Difference of -1.00 PESO for your staff Vanny Cruz [Back-Office Adminstrator]) \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]',
                            TaxAmount: -3.19,
                            LineAmount: -31.86
                        }
                    ],
                    AmountDue: 1254.33,
                    SubTotal: 1140.3,
                    TotalTax: 114.03,
                    Total: 1254.33,

                };

                var xero_payment_1 = {
                    Account: {
                        AccountID: "E0A58E94-6524-42D9-B8C8-BCA5DB92790C"
                    },
                    Invoice: {
                        InvoiceID: "dcf0dfd0-b023-4acb-bb76-1c1f3cba3ae0",
                        InvoiceNumber: '14076-00000006'
                    },
                    Amount: 1254.33,
                    Date: "2017-06-21"
                };


                var xero_payment_2 = {
                    Account: {
                        AccountID: "E0A58E94-6524-42D9-B8C8-BCA5DB92790C"
                    },
                    Invoice: {
                        InvoiceID: "dcf0dfd0-b023-4acb-bb76-1c1f3cba3ae1",
                        InvoiceNumber: '14077-00000006'
                    },
                    Amount: 1254.33,
                    Date: "2017-06-21"
                };

                var all_xero_invoices = [];
                all_xero_invoices.push(xero_invoice_1);
                all_xero_invoices.push(xero_invoice_2);

                var all_xero_payments = [];
                all_xero_payments.push(xero_payment_1);
                all_xero_payments.push(xero_payment_2);

                //Mysl saving
                all_given_creation_promises.push(helper.createSqlObject(leadsSchema, client_1));
                all_given_creation_promises.push(helper.createSqlObject(leadsSchema, client_2));
                all_given_creation_promises.push(helper.createSqlObject(adminSchema, admin));
                all_given_creation_promises.push(helper.createSqlObject(personalSchema, personal_1));
                all_given_creation_promises.push(helper.createSqlObject(personalSchema, personal_2));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsSchema, subcon_1));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsSchema, subcon_2));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_2));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_3));
                all_given_creation_promises.push(helper.createSqlObject(currencyAdjustmentRegularInvoicingSchema, currency_adjustments_regular_invoicing));
                all_given_creation_promises.push(helper.generate_timesheet(timesheet_june_1, "locked", 177, 8.00));
                all_given_creation_promises.push(helper.generate_timesheet(timesheet_june_2, "locked", 177, 8.00));


                //Mongo saving
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, xero_contact_details_1));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, xero_contact_details_2));

                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroPaymentsToSync", xeroPaymentsToSyncSchema, xero_payment_1));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroPaymentsToSync", xeroPaymentsToSyncSchema, xero_payment_2));


                var mock = require('mock-require');
                mock('xero-node', {
                    PrivateApplication: function() {

                        var xeroClient = {
                            core: {
                                payments: {
                                    savePayments: function (payments){
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
                                    newPayment: function(current_data){
                                        var newPayment = current_data;

                                        return newPayment;

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
                    xero_bull.processBatchPayments({},
                        function(err, response){

                            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");


                            var XeroPaymentErrorsModel = db_xero.model("XeroPaymentErrors", xeroPaymentsErrorsSchema);
                            var xeroPaymentsErrorsObj = new XeroPaymentErrorsModel();


                            db_xero.once("open", function(){
                                db_xero.close();
                            });



                            xeroPaymentsErrorsObj.getOneData("batch_saving_error", true).then(function(xero_error){
                                try{
                                    expect(xero_error.InvoiceNumber).to.be.equal("batch_saving_error");
                                    expect(xero_error.ErrorMessage).to.have.string('Server Unavailable');


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