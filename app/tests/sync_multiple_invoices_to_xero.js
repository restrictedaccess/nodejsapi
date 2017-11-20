
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
var xeroInvoiceToSyncSchema = require("../models/XeroInvoicesToSync");
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

                var all_xero_invoices = [];
                all_xero_invoices.push(xero_invoice_1);
                all_xero_invoices.push(xero_invoice_2);

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

                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroInvoiceToSyncSchema, xero_invoice_1));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroInvoiceToSyncSchema, xero_invoice_2));


                var mock = require('mock-require');
                mock('xero-node', {
                    PrivateApplication: function() {

                        var xeroClient = {
                            core: {
                                invoices: {
                                    saveInvoices: function (invoices){
                                        var defered = Q.defer();
                                        var promise = defered.promise;

                                        function createToJson(i){
                                            var current_invoice = all_xero_invoices[i];
                                            invoices[i].toJSON = function(){
                                                return current_invoice;
                                            };
                                        }

                                        for(var i = 0;i < invoices.length;i++){
                                            createToJson(i);
                                        }

                                        defered.resolve({
                                            entities: invoices
                                        });

                                        return promise;
                                    },
                                    newInvoice: function(current_data){
                                        var newInvoice = current_data;

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
                    xero_bull.processBatchInvoices(
                        {
                            data: {

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



                            xeroInvoiceObj.getAllData(true).then(function(batch_data){
                                try{
                                    console.log(batch_data);

                                    var synced_invoice_1 = batch_data[0];
                                    var synced_invoice_2 = batch_data[1];




                                    expect(synced_invoice_1.Type).to.be.equal("ACCREC");
                                    expect(synced_invoice_1.InvoiceNumber).to.be.equal("14077-00000006");
                                    expect(synced_invoice_1.AmountDue).to.be.equal(1254.33);
                                    expect(synced_invoice_1.Status).to.be.equal("AUTHORISED");
                                    expect(synced_invoice_1.DueDate).to.be.equal("2017-06-09");
                                    expect(synced_invoice_1.LineAmountTypes).to.be.equal("Exclusive");
                                    expect(synced_invoice_1.CurrencyCode).to.be.equal("AUD");
                                    expect(synced_invoice_1.SubTotal).to.be.equal(1140.3);
                                    expect(synced_invoice_1.TotalTax).to.be.equal(114.03);
                                    expect(synced_invoice_1.Total).to.be.equal(1254.33);
                                    expect(synced_invoice_1.Contact.ContactID).to.be.equal("7a48ccba-1809-466e-be8a-b2ae53e08f7d");
                                    expect(synced_invoice_1.LineItems).to.have.lengthOf(2);

                                    var first_item = synced_invoice_1.LineItems[0];
                                    expect(first_item.Description).to.be.equal("Vanny Cruz [Back-Office Adminstrator] \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]");
                                    expect(first_item.UnitAmount).to.be.equal(6.66);
                                    expect(first_item.Quantity).to.be.equal(177);
                                    expect(first_item.TaxType).to.be.equal("OUTPUT");
                                    expect(first_item.LineAmount).to.be.equal(1178.82);
                                    expect(first_item.TaxAmount).to.be.equal(117.88);
                                    expect(first_item.AccountCode).to.be.equal("RRH");

                                    var second_item = synced_invoice_1.LineItems[1];
                                    expect(second_item.Description).to.be.equal('Currency Adjustment (Contract Rate 1 AUD = 36.00 PESO vs. Current Rate 1 AUD = 37.00 PESO, Currency Difference of -1.00 PESO for your staff Vanny Cruz [Back-Office Adminstrator]) \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]')
                                    expect(second_item.UnitAmount).to.be.equal(-0.18);
                                    expect(second_item.Quantity).to.be.equal(177);
                                    expect(second_item.TaxType).to.be.equal("");
                                    expect(second_item.LineAmount).to.be.equal(-31.86);
                                    expect(second_item.AccountCode).to.be.equal("CUR LOS");


                                    expect(synced_invoice_2.Type).to.be.equal("ACCREC");
                                    expect(synced_invoice_2.InvoiceNumber).to.be.equal("14076-00000006");
                                    expect(synced_invoice_2.AmountDue).to.be.equal(1254.33);
                                    expect(synced_invoice_2.Status).to.be.equal("AUTHORISED");
                                    expect(synced_invoice_2.DueDate).to.be.equal("2017-06-09");
                                    expect(synced_invoice_2.LineAmountTypes).to.be.equal("Exclusive");
                                    expect(synced_invoice_2.CurrencyCode).to.be.equal("AUD");
                                    expect(synced_invoice_2.SubTotal).to.be.equal(1140.3);
                                    expect(synced_invoice_2.TotalTax).to.be.equal(114.03);
                                    expect(synced_invoice_2.Total).to.be.equal(1254.33);
                                    expect(synced_invoice_2.Contact.ContactID).to.be.equal("7a48ccba-1809-466e-be8a-b2ae53e08f7c");
                                    expect(synced_invoice_2.LineItems).to.have.lengthOf(2);

                                    var first_item = synced_invoice_2.LineItems[0];
                                    expect(first_item.Description).to.be.equal("Veronica Ann Reyes [Back-Office Adminstrator] \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]");
                                    expect(first_item.UnitAmount).to.be.equal(6.66);
                                    expect(first_item.Quantity).to.be.equal(177);
                                    expect(first_item.TaxType).to.be.equal("OUTPUT");
                                    expect(first_item.LineAmount).to.be.equal(1178.82);
                                    expect(first_item.TaxAmount).to.be.equal(117.88);
                                    expect(first_item.AccountCode).to.be.equal("RRH");

                                    var second_item = synced_invoice_2.LineItems[1];
                                    expect(second_item.Description).to.be.equal('Currency Adjustment (Contract Rate 1 AUD = 36.00 PESO vs. Current Rate 1 AUD = 37.00 PESO, Currency Difference of -1.00 PESO for your staff Veronica Ann Reyes [Back-Office Adminstrator]) \n\nDate Coverage: [17 Jun 01 to 17 Jun 30]')
                                    expect(second_item.UnitAmount).to.be.equal(-0.18);
                                    expect(second_item.Quantity).to.be.equal(177);
                                    expect(second_item.TaxType).to.be.equal("");
                                    expect(second_item.LineAmount).to.be.equal(-31.86);
                                    expect(second_item.AccountCode).to.be.equal("CUR LOS");






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