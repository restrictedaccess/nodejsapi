var supertest = require("supertest");
var should = require("should");
// This agent refers to PORT where program is running.
var server = supertest.agent("http://localhost:3000");
describe("Subcontractors Module TEST", function() {
    describe("Client Hourly and Daily Rate (full time and part time) w/o OT = PORTAL-125", function() {
        it("Client Hourly Rate Full Time", (done) => {
            server.get("/subcontractors/get-hourly-rate?subcon_id=6981").expect("Content-type", /json/).expect(200)// THis is HTTP response
            .end(function(err, res, body) {
                res.status.should.equal(200);
                res.body.success.should.equal(true);
                res.body.result.should.equal(9.96);
                done();
            });
        });
        it("Client Hourly Rate Part Time", (done) => {  
            server.get("/subcontractors/get-hourly-rate?subcon_id=6870").expect("Content-type", /json/).expect(200)// THis is HTTP response
            .end(function(err, res, body) {
                res.status.should.equal(200);
                res.body.success.should.equal(true);
                res.body.result.should.equal(13.06);
                done();
            });
        });
        it("Client Daily Rate Full Time", (done) => {  
             server.get("/subcontractors/get-daily-rate?subcon_id=6981").expect("Content-type", /json/).expect(200)// THis is HTTP response
            .end(function(err, res, body) {
                res.status.should.equal(200);
                res.body.success.should.equal(true);
                res.body.result.should.equal(79.65);
                done();
            });
        });
        it("Client Daily Rate Part Time", (done) => {  
            server.get("/subcontractors/get-daily-rate?subcon_id=6870").expect("Content-type", /json/).expect(200)// THis is HTTP response
            .end(function(err, res, body) {
                res.status.should.equal(200);
                res.body.success.should.equal(true);
                res.body.result.should.equal(52.25);
                done();
            });
        });

    });
});