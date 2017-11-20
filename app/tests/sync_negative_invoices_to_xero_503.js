
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
var xeroInvoiceErrorsSchema = require("../models/XeroInvoiceErrors");
var xeroCreditNotesErrorsSchema = require("../models/XeroCreditNotesErrors");
var xeroContactSchema = require("../models/XeroContact");

/**
 * ER-101 As an Accounts I want to optimize Xero so that it will be synced with RS Invoice Management System
 *
 */

describe("System syncs negative invoices to xero.com as Credit Note", function(){
    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            helper.mockPath();
            done();
        });
    });


    describe("An admin creates an invoice with a negative amount with a type Credit Note Memo but xero.com responds with a 503 error code [Unhappy Path] When Xero.com responds with a 503 error code", function(){

        it("A history of the error code will be recorded", function(done){
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
                    fname: "Mathieu",
                    lname: "Cornillon",
                    email: "mathieu@sherpa.net.au",
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


                //timesheets

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
                    order_id: "14076-00000008",
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

                var xero_contact_details = {
                    ContactID: "7a48ccba-1809-466e-be8a-b2ae53e08f7c",
                    ContactNumber: client.id.toString()
                };


                //Mysl saving
                all_given_creation_promises.push(helper.createSqlObject(leadsSchema, client));
                all_given_creation_promises.push(helper.createSqlObject(adminSchema, admin));
                all_given_creation_promises.push(helper.createSqlObject(personalSchema, personal));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsSchema, subcon));
                all_given_creation_promises.push(helper.createSqlObject(subcontractorsClienRateSchema, subcon_client_rate_2));
                all_given_creation_promises.push(helper.createSqlObject(currencyAdjustmentRegularInvoicingSchema, currency_adjustments_regular_invoicing));
                all_given_creation_promises.push(helper.generate_timesheet(timesheet_june, "locked", 160, 8.00));


                //Mongo saving
                all_given_creation_promises.push(helper.createMongoObject("prod", "Client", clientsMongoSchema, client_settings));
                all_given_creation_promises.push(helper.createMongoObject("prod", "Subcontractor", subcontractorsReportingSchema, subcontractors_reporting));
                all_given_creation_promises.push(helper.createMongoObject("prod", "Invoice", invoiceSchema, invoice_details));
                all_given_creation_promises.push(helper.createMongoObject("xero", "XeroContact", xeroContactSchema, xero_contact_details));


                var mock = require('mock-require');
                mock('xero-node', {
                    PrivateApplication: function() {
                        var xeroClient = {
                            core: {
                                creditNotes: {
                                    newCreditNote: function(){
                                        var newCreditNote = {
                                            save: function(){
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
                                            }
                                        };

                                        return newCreditNote;

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

                            var db_xero = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero");


                            var XeroCreditNoteErrorsModel = db_xero.model("XeroCreditNoteErrors", xeroCreditNotesErrorsSchema);
                            var xeroCreditNotesErrorsObj = new XeroCreditNoteErrorsModel();


                            db_xero.once("open", function(){
                                db_xero.close();
                            });


                            xeroCreditNotesErrorsObj.getOneData(invoice_details.order_id, true).then(function(synced_credit_note){

                                try{
                                    console.log(synced_credit_note);
                                    expect(synced_credit_note.CreditNoteNumber).to.be.equal("14076-00000008");
                                    expect(synced_credit_note.ErrorMessage).to.have.string('Server Unavailable');

                                    done();
                                } catch(saving_error){
                                    done(saving_error);
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