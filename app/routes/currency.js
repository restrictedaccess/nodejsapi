var express = require('express');
var router = express.Router();
var env = require("../config/env");
var Q = require("q");
var configs = require("../config/configs");
var moment_tz = require('moment-timezone');


router.get("/save-from-xe-com", function(req,res,next){ 
    var https = require("https"); 
    if(env.environment == "production"){ 
        http = https; 
    } 
 
 
    var formulas = { 
        AUD: "-1", 
        GBP: "-1.5", 
        USD: "-1.5" 
    }; 
    var currencies = [ 
        "AUD", 
        "GBP", 
        "USD" 
    ]; 
 
    //then call the API http://test.api.remotestaff.com.au/currency-adjustment/save/ 
    function syncCurrencyAdjustment(final_rate, from_currency){ 
        var willDefer = Q.defer(); 
        var willFullfill = willDefer.promise; 
        try{ 
            var callback = function(response) { 
                var str = ''; 
 
                //another chunk of data has been recieved, so append it to `str` 
                response.on('data', function (chunk) { 
                    str += chunk; 
                }); 
 
                //the whole response has been recieved, so we just print it out here 
                response.on('end', function () { 
                    console.log(str); 
                    willDefer.resolve(str); 
                }); 
            }; 
 
 
            var request_str = configs.getAPIURL() + '/currency-adjustment/save/?admin_id=143&currency=' + from_currency + "&rate=" + final_rate + "&effective_date=" + moment_tz().toISOString(); 
            console.log("calling " + request_str); 
 
            http.get(request_str, callback); 
 
        } catch(error){ 
            console.log("Error syncing currency adjustment"); 
            console.log(error); 
            willDefer.resolve(false); 
        } 
 
        return willFullfill; 
    } 
 
 
    function fetchFromXE(from_currency){ 
        var willFullFillDefer = Q.defer(); 
        var willDeferedFull = willFullFillDefer.promise; 
 
        var fetch_xe_defer = Q.defer(); 
        var fetch_xe_promise = fetch_xe_defer.promise; 
 
 
        //fetch data from xe.com 
        var options = { 
            host : 'xecdapi.xe.com', 
            path: '/v1/convert_from?from=' + from_currency + '&to=PHP', 
            headers:{ 
                'Authorization': 'Basic ' + new Buffer("remotestaffinc.459604335:fke5bb41lt3f7i5dpm9i2ivugt").toString('base64'), 
                "Content-Type": "application/json" 
            }, 
            method: "GET" 
 
        }; 
        https.get(options, function(response) { 
 
            var str = ''; 
 
            //another chunk of data has been recieved, so append it to `str` 
            response.on('data', function (chunk) { 
                str += chunk; 
            }); 
 
            //the whole response has been recieved, so we just print it out here 
            response.on('end', function () { 
 
                fetch_xe_defer.resolve(JSON.parse(str)); 
            }); 
        }); 
 
 
        fetch_xe_promise.then(function(xe_response){ 
            console.log(xe_response); 
 
            function evaluateRateFromXE(current_rate_from_xe){ 
 
                var willDefer = Q.defer(); 
                var willFullfil = willDefer.promise; 
 
                var to_currency_rate = current_rate_from_xe.mid; 
                var curent_formula = formulas[from_currency]; 
                var final_rate = eval(eval("to_currency_rate + curent_formula")); 
                final_rate = final_rate.toFixed(2); 
                console.log(final_rate); 
 
 
                var request_promise = syncCurrencyAdjustment(final_rate, from_currency); 
 
                request_promise.then(function(request_result){ 
                    console.log("Successfully synced to currency adjustment"); 
                    willDefer.resolve(request_result); 
                }); 
 
                return willFullfil; 
            } 
 
            var all_evaluation_promises = []; 
 
            var current_rate_from_xe = xe_response.to[0]; 
 
            var evaluation_promise = evaluateRateFromXE(current_rate_from_xe); 
 
            evaluation_promise.then(function(ca_result){ 
                willFullFillDefer.resolve(ca_result); 
            }); 
 
 
        }); 
 
 
        return willDeferedFull; 
    } 
 
 
    var all_fetch_promises = []; 
    for(var i = 0;i < currencies.length;i++){ 
        all_fetch_promises.push(fetchFromXE(currencies[i])); 
    } 
 
    Q.allSettled(all_fetch_promises).then(function(results){ 
        return res.status(200).send({success:true, result:results}); 
    }); 
 
 
 
});
module.exports = router;