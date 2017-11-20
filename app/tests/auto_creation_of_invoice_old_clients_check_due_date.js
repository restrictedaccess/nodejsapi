/**
 * Created by JMOQUENDO on 6/28/17.
 */

var Q = require('q');
var mongoose = require('mongoose');
var assert = require("assert");
var chai = require('chai'),
    expect = chai.expect,
    should = chai.should();

const request = require('supertest');
var app = require("../app");

var moment = require("moment");
require('moment-weekday-calc');
var moment_tz = require('moment-timezone');

var configs = require("../config/configs");
var helper = require("../tests/helper");
var nock = require('nock');



describe("Auto Creation of Invoice for Old Client", function() {

    //Scenario 1
    describe("Due date should be 5 businessdays from invoice date", function(){

        it("should be saving to our system", function(done) {
                //GIVEN
                 var given_promise = [];
                 var invoice_date = new Date(moment("2017-06-12T00:00:00Z").format("YYYY-MM-05"));
                 var due_date = helper.getBusinessDays(moment(invoice_date),5);
                 given_promise.push(due_date);

             Q.allSettled(given_promise).then(function(results) {
                 try{
                     console.log("all given creation done");
                     console.log(results[0].value);
                     expect(results[0].value).to.equal("2017-06-12");
                     console.log(moment().weekdayCalc(new Date(moment().format("1 MMM YYYY")),new Date(moment().format("30 MMM YYYY")),[1,2,3,4,5]));
                     done();
                 } catch(testing_error){
                     console.log(testing_error);
                     done(testing_error);
                 }

                });
        });
    });



});

