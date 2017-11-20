/**
 * Created by Josef Balisalisa on 6/15/17.
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
var moment_tz = require("moment");



var configs = require("../config/configs");
var helper = require("../tests/helper");
var nock = require('nock');


var mongoCredentials = configs.getMongoCredentials();

var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");
var CurrencyRateHistorySchema = require("../models/CurrencyRateHistory");

/**
 * EBRFO-85 This is to fetch XE.com API data and store on our server
 * Happy Path
 * When Xe.com responds with the following json format:
 *
 */

describe("System syncs currency adjustment from xe.com", function(){

    before(function(done){
        this.timeout(30000);
        console.log("Before Test");
        helper.migrateAll().then(function(stdout){
            done();
        });
    });


    //Scenario 1
    describe("Xe.com responds with VALID response", function(){

        it("should be saving to our system", function(done){
            this.timeout(5000);
            var adminInfoSchema = require("../mysql/Admin_Info");

            //create allanair admin
            var all_mysql_init_promises = [];

            var allanaire_admin_defer = Q.defer();
            var allanaire_admin_promise = allanaire_admin_defer.promise;
            all_mysql_init_promises.push(allanaire_admin_promise);

            var allanaire_admin = {
                admin_id: 143,
                admin_fname: "Allanaire",
                admin_lname: "Tapion",
                currency_adjustment: "Y"
            };



            adminInfoSchema.build(allanaire_admin).save().then(function (savedItem) {
                console.log("Saved admin allanaire");
                allanaire_admin_defer.resolve(savedItem);
            }).catch(function (error) {
                console.log("Error saving allanaire admin");
                console.log(error);
                allanaire_admin_defer.resolve(null);
                done(error);
            });


            //Given:
            var xe_com_aud = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=AUD&to=PHP')
                .reply(200,
                    {
                        "terms":"http://www.xe.com/legal/dfs.php",
                        "privacy":"http://www.xe.com/privacy.php",
                        "from": "AUD",
                        "timestamp": "2017-06-15T16:59:00Z",
                        "to": [
                            {
                                "quotecurrency": "PHP",
                                "mid": 37.70
                            }
                        ]
                    });

            var xe_com_gbp = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=GBP&to=PHP')
                .reply(200,
                    {
                        "terms":"http://www.xe.com/legal/dfs.php",
                        "privacy":"http://www.xe.com/privacy.php",
                        "from": "GBP",
                        "timestamp": "2017-06-15T16:59:00Z",
                        "to": [
                            {
                                "quotecurrency": "PHP",
                                "mid": 63.13
                            }
                        ]
                    });

            var xe_com_usd = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=USD&to=PHP')
                .reply(200,
                    {
                        "terms":"http://www.xe.com/legal/dfs.php",
                        "privacy":"http://www.xe.com/privacy.php",
                        "from": "USD",
                        "timestamp": "2017-06-15T16:59:00Z",
                        "to": [
                            {
                                "quotecurrency": "PHP",
                                "mid": 49.58
                            }
                        ]
                    });

            Q.allSettled(all_mysql_init_promises).then(function(init_results){

                request(app).get("/currency-adjustments/sync-currency-adjustments-from-xe")
                    .end(function(err, res) {
                        if(err) {
                            console.log(err);
                            done(err);
                        }

                        var all_fetch_promises = [];

                        //mysql fetch promises
                        var aud_fetch_defer = Q.defer();
                        var aud_fetch_promise = aud_fetch_defer.promise;
                        all_fetch_promises.push(aud_fetch_promise);

                        var gbp_fetch_defer = Q.defer();
                        var gbp_fetch_promise = gbp_fetch_defer.promise;
                        all_fetch_promises.push(gbp_fetch_promise);

                        var usd_fetch_defer = Q.defer();
                        var usd_fetch_promise = usd_fetch_defer.promise;
                        all_fetch_promises.push(usd_fetch_promise);


                        //history fetch promises
                        var aud_history_defer = Q.defer();
                        var aud_history_promise = aud_history_defer.promise;
                        all_fetch_promises.push(aud_history_promise);


                        var gbp_history_defer = Q.defer();
                        var gbp_history_promise = gbp_history_defer.promise;
                        all_fetch_promises.push(gbp_history_promise);


                        var usd_history_defer = Q.defer();
                        var usd_history_promise = usd_history_defer.promise;
                        all_fetch_promises.push(usd_history_promise);


                        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/currency_adjustments",mongoCredentials.options);

                        var CurrencyRateHistory = db.model("CurrencyRateHistory", CurrencyRateHistorySchema);

                        db.once('open', function() {

                            it("should have saved history having log as 'Added new currency rate' AUD", function(){

                                CurrencyRateHistory.findOne(
                                    {
                                        currency: "AUD",
                                        log: "Added new currency rate",
                                    }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                    if(foundHistory){

                                        try{
                                            expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                            expect(foundHistory.log).to.have.string("Added new currency rate");

                                        } catch(major_error){
                                            console.log(major_error);
                                            done(major_error);
                                        }

                                    }
                                    aud_history_defer.resolve(foundHistory);
                                });

                            });

                            it("should have saved history having log as 'Added new currency rate' GBP", function () {

                                CurrencyRateHistory.findOne(
                                    {
                                        currency: "GBP",
                                        log: "Added new currency rate",
                                    }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                    if(foundHistory){

                                        try{
                                            expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                            expect(foundHistory.log).to.have.string("Added new currency rate");
                                        } catch(major_error){
                                            console.log(major_error);
                                            done(major_error);
                                        }

                                    }
                                    gbp_history_defer.resolve(foundHistory);
                                });
                            });




                            it("should have saved history having log as 'Added new currency rate' GBP", function () {
                                CurrencyRateHistory.findOne(
                                    {
                                        currency: "USD",
                                        log: "Added new currency rate",
                                    }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                    if(foundHistory){

                                        try{
                                            expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                            expect(foundHistory.log).to.have.string("Added new currency rate");
                                        } catch(major_error){
                                            console.log(major_error);
                                            done(major_error);
                                        }
                                    }
                                    usd_history_defer.resolve(foundHistory);
                                });
                            });
                        });

                        it("should save (AUD converted to PHP) – 1", function () {
                            CurrencyAdjustment.findOne({
                                where:{
                                    currency:"AUD",
                                    active: "yes"
                                }
                            }).then(function(forex_rate_value) {
                                if(forex_rate_value){

                                    try{
                                        expect(forex_rate_value.rate).to.equal(36.7);
                                    } catch(major_error){
                                        console.log(major_error);
                                        done(major_error);
                                    }

                                }
                                aud_fetch_defer.resolve(forex_rate_value);
                            });
                        });



                        it("should save (GBP converted to PHP) – 1.5", function () {

                            CurrencyAdjustment.findOne({
                                where:{
                                    currency:"GBP",
                                    active: "yes"
                                }
                            }).then(function(forex_rate_value) {
                                if(forex_rate_value){

                                    try{
                                        expect(forex_rate_value.rate).to.equal(61.63);
                                    } catch(major_error){
                                        console.log(major_error);
                                        done(major_error);
                                    }

                                }
                                gbp_fetch_defer.resolve(forex_rate_value);
                            });
                        });




                        it("should save (USD converted to PHP) – 1.5", function () {
                            CurrencyAdjustment.findOne({
                                where:{
                                    currency:"USD",
                                    active: "yes"
                                }
                            }).then(function(forex_rate_value) {
                                if(forex_rate_value){

                                    try{
                                        expect(forex_rate_value.rate).to.equal(48.08);
                                    } catch(major_error){
                                        console.log(major_error);
                                        done(major_error);
                                    }

                                }
                                usd_fetch_defer.resolve(forex_rate_value);
                            });

                        });

                        Q.allSettled(all_fetch_promises).then(function(fetch_results){
                            db.close();
                            done();
                        });

                    });

            });


        });

    });



    describe("Xe.com responds with an INVALID Response", function(){
        it("should not be saved in our systems", function(done){
            this.timeout(30000);


            //Given:
            var xe_com_aud = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=AUD&to=PHP')
                .reply(200,
                    {
                        "code": 0,
                        "message": "An unexpected error occurred",
                        "documentation_url": "https://xecdapi.xe.com/docs/v1/"
                    });

            var xe_com_gbp = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=GBP&to=PHP')
                .reply(200,
                    {
                        "code": 0,
                        "message": "An unexpected error occurred",
                        "documentation_url": "https://xecdapi.xe.com/docs/v1/"
                    });

            var xe_com_usd = nock('https://xecdapi.xe.com', {
                reqheaders: {
                    'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'),
                    "Content-Type": "application/json"
                }
            })
                .get('/v1/convert_from?from=USD&to=PHP')
                .reply(200,
                    {
                        "code": 0,
                        "message": "An unexpected error occurred",
                        "documentation_url": "https://xecdapi.xe.com/docs/v1/"
                    });


            //Call the API
            request(app).get("/currency-adjustments/sync-currency-adjustments-from-xe")
                .end(function(err, res) {
                    if(err) return done(err);

                    var all_fetch_promises = [];

                    //mysql fetch promises
                    var aud_fetch_defer = Q.defer();
                    var aud_fetch_promise = aud_fetch_defer.promise;
                    all_fetch_promises.push(aud_fetch_promise);

                    var gbp_fetch_defer = Q.defer();
                    var gbp_fetch_promise = gbp_fetch_defer.promise;
                    all_fetch_promises.push(gbp_fetch_promise);

                    var usd_fetch_defer = Q.defer();
                    var usd_fetch_promise = usd_fetch_defer.promise;
                    all_fetch_promises.push(usd_fetch_promise);


                    //history fetch promises
                    var aud_history_defer = Q.defer();
                    var aud_history_promise = aud_history_defer.promise;
                    all_fetch_promises.push(aud_history_promise);


                    var gbp_history_defer = Q.defer();
                    var gbp_history_promise = gbp_history_defer.promise;
                    all_fetch_promises.push(gbp_history_promise);


                    var usd_history_defer = Q.defer();
                    var usd_history_promise = usd_history_defer.promise;
                    all_fetch_promises.push(usd_history_promise);



                    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/currency_adjustments",mongoCredentials.options);

                    var CurrencyRateHistory = db.model("CurrencyRateHistory", CurrencyRateHistorySchema);

                    db.on('error', function(error){
                        console.log(error);
                        done(error);
                    });

                    db.once('open', function() {

                        try{

                            CurrencyRateHistory.findOne(
                                {
                                    currency: "AUD",
                                    log: new RegExp('^XE.com error$', "i"),
                                }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                if(foundHistory){
                                    try{
                                        expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                        expect(foundHistory.log).to.have.string('XE.com error');
                                    } catch(testing_error){
                                        console.log(testing_error);
                                        done(testing_error);
                                    }

                                }
                                aud_history_defer.resolve(foundHistory);
                            });




                            CurrencyRateHistory.findOne(
                                {
                                    currency: "GBP",
                                    log: new RegExp('^XE.com error$', "i"),
                                }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                if(foundHistory){
                                    try{
                                        expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                        expect(foundHistory.log).to.have.string('XE.com error');
                                    } catch(testing_error){
                                        console.log(testing_error);
                                        done(testing_error);
                                    }

                                }
                                gbp_history_defer.resolve(foundHistory);
                            });



                            CurrencyRateHistory.findOne(
                                {
                                    currency: "USD",
                                    log: new RegExp('^XE.com error$', "i"),
                                }).sort({date_added: -1}).lean().exec(function (err, foundHistory) {
                                if(foundHistory){
                                    try{
                                        expect(foundHistory.effective_date).to.equal(moment_tz().format("YYYY-MM-DD"));
                                        expect(foundHistory.log).to.have.string('XE.com error');
                                    } catch(testing_error){
                                        console.log(testing_error);
                                        done(testing_error);
                                    }

                                }
                                usd_history_defer.resolve(foundHistory);
                            });

                        } catch(major_error){
                            console.log(major_error);
                            done(major_error);
                        }



                    });


                    try{


                        CurrencyAdjustment.findOne({
                            where:{
                                currency:"AUD",
                                active: "yes"
                            }
                        }).then(function(forex_rate_value) {
                            //the same as the previous
                            if(forex_rate_value){
                                try{
                                    expect(forex_rate_value.rate).to.equal(36.7);
                                } catch(testing_error){
                                    console.log(testing_error);
                                    done(testing_error);
                                }

                            }

                            aud_fetch_defer.resolve(forex_rate_value);
                        });




                        CurrencyAdjustment.findOne({
                            where:{
                                currency:"GBP",
                                active: "yes"
                            }
                        }).then(function(forex_rate_value) {
                            //the same as the previous
                            if(forex_rate_value){
                                try{
                                    expect(forex_rate_value.rate).to.equal(61.63);
                                } catch(testing_error){
                                    console.log(testing_error);
                                    done(testing_error);
                                }

                            }

                            gbp_fetch_defer.resolve(forex_rate_value);
                        });






                        CurrencyAdjustment.findOne({
                            where:{
                                currency:"USD",
                                active: "yes"
                            }
                        }).then(function(forex_rate_value) {
                            //the same as the previous
                            if(forex_rate_value){
                                try{
                                    expect(forex_rate_value.rate).to.equal(48.08);
                                } catch(testing_error){
                                    console.log(testing_error);
                                    done(testing_error);
                                }

                            }

                            usd_fetch_defer.resolve(forex_rate_value);
                        });

                    } catch(major_error){
                        console.log(major_error);
                        done(major_error);
                    }


                    Q.allSettled(all_fetch_promises).then(function(fetch_results){
                        db.close();
                        done();
                    });

                });


        });
    });


    after(function(done){
        this.timeout(30000);
        helper.revertAll().then(function(stdout){
            done();
        });

    });
});