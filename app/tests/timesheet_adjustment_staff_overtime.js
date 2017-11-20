var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();

const request = require('supertest');
var app = require("../app");


//SET UP MYSQL Connection
var configs = require("../config/configs");
var mysql = require("mysql");
var mysqlCredentials = configs.getMysqlCredentials();
var nano = configs.getCouchDb();
var client_docs_db = nano.use("client_docs");
var timerecords_db = nano.use("rssc_time_records");




var Lead = require("../mysql/Lead_Info");
var Personal_Info = require("../mysql/Personal_Info");
var Admin_Info = require("../mysql/Admin_Info");
var Timesheet =  require("../mysql/Timesheet");
var TimeSheetDetails =  require("../mysql/TimeSheetDetails");
var Subcontractors  =  require("../mysql/Subcontractors");
var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");

describe("timesheet_adjustment_staff_overtime", function(){

    before(function(done){
        
        var exec = require('child_process').exec;
        var cmdMysql = "cd /home/vagrant/app && sequelize db:migrate";
        exec(cmdMysql, function(error, stdout, stderr) {
            console.log("Migration Complete")
            done();
        });
    });

    it("should correctly adjust staff overtime", function(done){
        //GIVEN 
        var chris = null;
        var allanaire = null;
        var jerna = null
        var may_timesheet = null;
        var may_timesheet_details = null;
        var contract = null;
        var currency_adjustment = null;
        var available_balance = null;

        var promises = [];
        

        //Client
        var promise_lead = Lead.create({
            first_name:"Chris", 
            last_name:"Jankulovski", 
            id:11
        });

        promise_lead.then(function(client){
            chris = client;
        });
        promises.push(promise_lead);

        //Staff
        var promise_staff = Personal_Info.create({
            fname : "Allanaire",
            lname : "Tapion",
            userid : 37555
        });

        promise_staff.then(function(staff){
            allanaire =staff;
        });
        promises.push(promise_staff);

        //Admin
        var promise_admin =  Admin_Info.create({
            admin_fname : "Jerna",
            admin_lname : "Malonzo",
            admin_id : 143
        });

        promise_admin.then(function(admin){
            jerna = admin;
        });
        promises.push(promise_admin);

        //Timesheet
        var promise_timesheet =  Timesheet.create({
            leads_id : 11,
            userid : 37555,
            subcontractors_id : 3054,
            month_year: "2017-05-01 00:00:00",
            status: "open",
            id : 1
        });
        promise_timesheet.then(function(timesheet){
            may_timesheet = timesheet;
        });
        promises.push(promise_timesheet);

        //Timesheet Details
        var promise_timesheet_details = TimeSheetDetails.create({
            id: 1,
            timesheet_id :1,
            day: 1,
            adj_hrs: 12,
            status: "open",
            reference_date: "2017-05-01"
        });
        promise_timesheet.then(function(timesheet_details){
            may_timesheet_details = timesheet_details;
        });

        promises.push(promise_timesheet_details);

        //Subcontractor
        var promise_subcontractor = Subcontractors.create({
            id: 3054,
            job_designation: "PHP DEVELOPER",
            leads_id: 11,
            userid: 37555,
            client_price: 972.22,
            work_status: "Full-Time"
        });

        promise_subcontractor.then(function(subcontractor){
            contract = subcontractor;
        });

        promises.push(promise_subcontractor);

        //CurrencyAdjustment
        var promise_currency = CurrencyAdjustment.create({
            currency: "AUD",
		    rate: 35.60,
            effective_date: new Date(),
		    active:"yes",
		    date_added: new Date()
        });

        promise_currency.then(function(currency_adjustment){
            currency_adjustment = currency_adjustment;
        });

        promises.push(currency_adjustment);
        

        //Available Balance
        function insertDoc(){
            var willFulfillDeferred = Q.defer();
	        var willFulfill = willFulfillDeferred.promise;

            var client_doc = {
                "client_hourly_rate": "0.00",
                "mongo_synced": true,
                "currency": "AUD",
                "running_balance": "2000.00",
                "client_id": 11,
                "particular": "Initial Credit",
                "remarks": "Generated from TEST",
                "credit_type": "WORK",
                "credit": "2000.00",
                "charge": "0.00",               
                "added_on": [
                    2016,
                    1,
                    29,
                    13,
                    18,
                    45
                ],
                "type": "credit accounting",
                "added_by": "RS System Mocha"
            };
            
            client_docs_db.insert(client_doc, function(err, body){
                willFulfillDeferred.resolve(body);
            });
            return willFulfill;
        }

        var promise_insert_doc = insertDoc();
        promises.push(promise_insert_doc);
        

        //RSSC Time Records
        function insertStaffWork(){
            var willFulfillDeferred = Q.defer();
	        var willFulfill = willFulfillDeferred.promise;

            var doc = {
                
                
                "prepaid": null,
                "subcontractors_id": 3054,
                "userid": 37555,
                "leads_id": 11,
                "time_in": [
                    2017,
                    5,
                    1,
                    7,
                    0,
                    0
                ],
                "time_out": [
                    2017,
                    5,
                    1,
                    19,
                    0,
                    0
                ],
                "type": "timerecord"

            };
            
            timerecords_db.insert(doc, function(err, body){
                willFulfillDeferred.resolve(body);
            });
            return willFulfill;
        }

        var promise_insert_work = insertStaffWork();
        promises.push(promise_insert_work);

        

    });


});