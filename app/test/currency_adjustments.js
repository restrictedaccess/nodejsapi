var supertest = require("supertest");
var should = require("should");
var Q = require('q');
// This agent refers to PORT where program is runninng.
var server = supertest.agent("http://localhost:3000");
describe("Currency Adjustment Module Test", function() {
	describe("Basic Checks", function(){
		it("Should return correct forex rate for AUD", function(done) {
			server.get("/currency-adjustments/get-forex-rate?currency=AUD&test=1").expect("Content-type", /json/).expect(200)// THis is HTTP response
			.end(function(err, res, body) {
				res.status.should.equal(200);
				res.body.success.should.equal(true);
				res.body.result.should.equal(35.03);
				done();
			});
		});
		it("Should return correct forex rate for USD", function(done) {
			server.get("/currency-adjustments/get-forex-rate?currency=USD&test=1").expect("Content-type", /json/).expect(200)// THis is HTTP response
			.end(function(err, res, body) {
				res.status.should.equal(200);
				res.body.success.should.equal(true);
				res.body.result.should.equal(45.00);
				done();
			});
		});
		it("Should return correct forex rate for GBP", function(done) {
			server.get("/currency-adjustments/get-forex-rate?currency=GBP&test=1").expect("Content-type", /json/).expect(200)// THis is HTTP response
			.end(function(err, res, body) {
				res.status.should.equal(200);
				res.body.success.should.equal(true);
				res.body.result.should.equal(65.23);
				done();
			});
		});
		it("Should return success false when currency parameter is missing", function(done) {
			server.get("/currency-adjustments/get-forex-rate?test=1").expect("Content-type", /json/).expect(200)// THis is HTTP response
			.end(function(err, res, body) {
				res.status.should.equal(200);
				res.body.success.should.equal(false);
				done();
			});
		});
		it("Should return all active currency adjustment", function(done){
			server.get("/currency-adjustments/get-all-active-forex-rate?test=1").expect("Content-type", /json/).expect(200)// THis is HTTP response
			.end(function(err, res, body) {
				var currencies = [
					{
						currency:"AUD",
						value:35.03
					},
					{
						currency:"USD",
						value:45
					},
					{
						currency:"GBP",
						value:65.23
					}
				];
				res.status.should.equal(200);
				res.body.success.should.equal(true);
				for(var i=0;i<currencies.length;i++){
					for(var j=0;j<res.body.result.length;j++){
						var test_currency = currencies[i];
						var result_currency = res.body.result[j];
						if (test_currency.currency == result_currency.currency){
							result_currency.rate.should.equal(test_currency.value);
						}
					}
				}
				done();
			});
		});
	});

	describe("Invoice with Computed Currency Adjustment - PORTAL-126", function(){
		it("Currency Adjustment if Forex is lesser than Contract Rate", function(done) {
			
			/**
			 * Forex Exchange from Chris: 34 AUD
			 * Currency AUD
			 */
			var forex_rate  = 34;
			function getCurrencyAdjustmentSubcon(subcon_id){
				var deferred_promise = Q.defer();
				var promise = deferred_promise.promise;
				server.get("/currency-adjustments/get-currency-adjustment-subcon?test=1&subcon_id="+subcon_id+"&forex_rate="+forex_rate).expect("Content-type", /json/).expect(200)// THis is HTTP response
				.end(function(err, res, body) {
					deferred_promise.resolve(res.body.result);	
				});
				return promise;
			}

			function getHourlyRate(subcon_id){
				var deferred_promise = Q.defer();
				var promise = deferred_promise.promise;
				server.get("/subcontractors/get-hourly-rate?subcon_id="+subcon_id).expect("Content-type", /json/).expect(200)// THis is HTTP response
				.end(function(err, res, body) {
					deferred_promise.resolve(res.body.result);
				});
				return promise;				
			}
			/**
			 * Add Cheryl Soliven - Subcon ID 6128
			 * Contract Current Rate: 35 AUD
			 * Hourly Rate: 4.38
			 */
			var sub_total = 0;
			
			var promise_hourly_soliven = getHourlyRate(6128);
			var total_rate_soliven = 0;
			var currency_adjustment_soliven = 0;

			promise_hourly_soliven.then((hourly_rate) => {
				total_rate_soliven = hourly_rate * 176;
				total_rate_soliven = Math.round(total_rate_soliven * 100) / 100;
				sub_total += total_rate_soliven;
			});

			var promise_soliven = getCurrencyAdjustmentSubcon(6128);
			promise_soliven.then((currency_adjustment) => {
				currency_adjustment_soliven = Math.round(currency_adjustment * 176 * 10000) / 10000;
				sub_total += currency_adjustment_soliven;
			});
			
			/**
			 * Add Marc Anthony Lim - Subcon ID 6396
			 * Contract Current Rate 35 AUD
			 * Hourly Rate 6.92 AUD
			 */

			var promise_hourly_lim = getHourlyRate(6396);
			var total_rate_lim = 0;
			var currency_adjustment_lim = 0;

			promise_hourly_lim.then((hourly_rate) => {
				total_rate_lim = hourly_rate * 176;
				sub_total += total_rate_lim;
			});

			var promise_lim = getCurrencyAdjustmentSubcon(6396);
			promise_lim.then((currency_adjustment) => {
				currency_adjustment_lim = currency_adjustment * 176;
				currency_adjustment_lim = Math.round(currency_adjustment_lim * 10000) / 10000;
				sub_total += currency_adjustment_lim;
			});

			Q.allSettled([promise_hourly_soliven, promise_soliven, promise_hourly_lim, promise_lim]).then(function(dones){
				total_rate_soliven.should.equal(770.88);
				currency_adjustment_soliven.should.equal(22.6729);
				
				var result_soliven = total_rate_soliven + currency_adjustment_soliven;
				result_soliven = Math.round(result_soliven * 10000) / 10000;
				result_soliven.should.equal(793.5529);
				total_rate_lim.should.equal(1217.92);
				currency_adjustment_lim.should.equal(35.8212);
				
				var result_lim = total_rate_lim + currency_adjustment_lim;
				result_lim = Math.round(result_lim * 10000) / 10000;
				result_lim.should.equal(1253.7412);

				sub_total = result_lim + result_soliven;
				sub_total.should.equal(2047.2941);

				var gst = sub_total * .1;
				gst = Math.round(gst * 10000) / 10000;
				gst.should.equal(204.7294);			

				var total  = sub_total + gst;
				total = Math.round(total * 10000) / 10000;
				total.should.equal(2252.0235);	
				done();
			});

			
		});

	});
});
