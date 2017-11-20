var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var env = require("../config/env");
var console = require('console');
var mongoose = require('mongoose');
var subcontractorSchema = require("../models/Subcontractor");
var CurrencyAdjustment = require("../mysql/CurrencyAdjustment");

var CurrencyAdjustmentRegularInvoicing = require("../mysql/CurrencyAdjustmentRegularInvoicing");
var adminInfoSchema = require("../mysql/Admin_Info");
var currencyRateMarginSchema = require("../mysql/CurrencyRateMargin");

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var is_numeric = require('locutus/php/var/is_numeric')
// var pool = mysql.createPool({
// 	host : mysqlCredentials.host,
// 	user : mysqlCredentials.user,
// 	password : mysqlCredentials.password,
// 	database : mysqlCredentials.database
// });


router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


/*
 * Get All Currency Rate Margins 
 * http://test.njs.remotestaff.com.au/currency-adjustments/get-all-currency-rate-margin 
 * */
router.all("/get-all-currency-rate-margin", function(req,res,next){	
		
	currencyRateMarginSchema.getAllCurrencyRateMargin().then(function(result){
		var result = {
			success:true,
			result:result			
		};
		return res.send(result, 200);
	}).catch(function(err){
		var result = {
			success:false,
			msg : err
		};
		return res.send(result, 200);
	});
	
});

/*
 * Get Latest Currency Rate Margins 
 * http://test.njs.remotestaff.com.au/currency-adjustments/get-latest-currency-rate-margin 
 * */
router.all("/get-latest-currency-rate-margin", function(req,res,next){	
		
	currencyRateMarginSchema.getLatestCurrencyRateMargin().then(function(result){
		var result = {
			success:true,
			result:result			
		};
		return res.send(result, 200);
	}).catch(function(err){
		var result = {
			success:false,
			msg : err
		};
		return res.send(result, 200);
	});
	
});




/*
 * Add Currency Rate Margin 
 * http://test.njs.remotestaff.com.au/currency-adjustments/add-currency-rate-margin 
 * */
router.post("/add-currency-rate-margin", function(req,res,next){	
	//console.log(req.body);	
	currencyRateMarginSchema.addCurrencyRateMargin(req.body).then(function(data){
		var result = {
			success:true			
		};
		return res.send(result, 200);
	}).catch(function(err){
		var result = {
			success:false,
			msg : err
		};
		return res.send(result, 200);
	});
	
});


/*
 * Get latest currency rate for regular invoicing 
 * http://test.njs.remotestaff.com.au/currency-adjustments/get-latest-currency-rate-regular 
 * */
router.all("/get-latest-currency-rate-regular", function(req,res,next){
	
	CurrencyAdjustmentRegularInvoicing.getLatestCurrencyAdjustmentRate().then(function(result){
		//console.log(result);
		result = {
			success:true,	
			msg : result				 
		};
		return res.send(result, 200);
	}).catch(function(err){
		result = {
			success:false,
			msg : err + " getLatestCurrencyAdjustmentRate"
		};
		return res.send(result, 200);
	});
		
});

/*
 * Get latest currency rate for regular invoicing 
 * http://test.njs.remotestaff.com.au/currency-adjustments/get-latest-currency-rate-regular 
 * */
router.all("/get-latest-currency-rate-regular", function(req,res,next){
	
	CurrencyAdjustmentRegularInvoicing.getLatestCurrencyAdjustmentRate().then(function(result){
		//console.log(result);
		result = {
			success:true,	
			msg : result				 
		};
		return res.send(result, 200);
	}).catch(function(err){
		result = {
			success:false,
			msg : err + " getLatestCurrencyAdjustmentRate"
		};
		return res.send(result, 200);
	});
		
});

/*
 * Get currency rate for regular invoicing histories
 * http://test.njs.remotestaff.com.au/currency-adjustments/get-currency-rate-regular-history 
 * */
router.all("/get-currency-rate-regular-history", function(req,res,next){

	
	CurrencyAdjustmentRegularInvoicing.getHistory().then(function(histories){
		//console.log(histories);
		result = {
			success:true,	
			msg : histories				 
		};
		return res.send(result, 200);
	}).catch(function(err){
		result = {
			success:false,
			msg : err + " getHistory"
		};
		return res.send(result, 200);
	});
	
});

/*
 * Method in saving currency rate for regular invoicing
 * http://test.njs.remotestaff.com.au/currency-adjustments/save-currency-rate-regular/ 
 * */
router.post("/save-currency-rate-regular", function(req,res,next){
	//console.log(req.body.admin_id);
	
	//Get admin info
	adminInfoSchema.getAdminInfo(req.body.admin_id).then(function(admin){
		//console.log(object.admin_fname);
		
		CurrencyAdjustmentRegularInvoicing.UpSert(req.body, admin).then(function(data){
			//console.log(data);
			result = {
				success:true,	
				msg : data				 
			};
			return res.send(result, 200);
		});
		
	}).catch(function(err){
		result = {
			success:false,
			msg : err + " getAdminInfo"
		};
		return res.send(result, 200);
	});

	
});

/**
 * Get the current forex rate from Chris based on given currency
 * @url http://test.njs.remotestaff.com.au/currency-adjustments/get-forex-rate/
 */
router.get("/get-forex-rate", function(req,res,next){
	if (typeof req.query.currency == "undefined"){
		return res.send({success:false, errors:"Missing Parameters"}, 200);
	}

    var where = {
        currency:req.query.currency
    };
    if (req.query.test=="1"){
    	if (where.currency=="AUD"){
	        where.effective_date = new Date("2016-05-05");      	
    	}else if (where.currency=="USD"){
    		where.effective_date = new Date("2016-04-30");
    	}else{
    		where.effective_date = new Date("2016-05-01");
    	}
          
    }else{
    	where.active = "yes";
    }
	CurrencyAdjustment.findOne({where:where}).then(function(currency_adjustment){
		var result;
		if (currency_adjustment==null){
		    result = {success:false, errors:"Not Found"};
		}else{
			result = {success:true, result:currency_adjustment.rate};
		}
	    return res.send(result, 200);		
	});
	

});

router.get("/")

/**
 * Get all active forex rate from Chris
 * @url http://test.njs.remotestaff.com.au/currency-adjustments/get-all-active-forex-rate/
 */
router.get("/get-all-active-forex-rate", function(req,res,next){
	var currencies = ["AUD", "GBP", "USD"];
	var test_params = "";
	if (req.query.test=="1"){
    	test_params = "&test=1";
    }

	function getCurrency(currency, i){
		var promise_Deferred = Q.defer();
		var promise = promise_Deferred.promise;

		http.get("http://127.0.0.1:3000"+'/currency-adjustments/get-forex-rate?currency='+currency+test_params, (res) => {
			res.setEncoding('utf-8');

			var body = '';

			res.on('data', function(chunk){
				body += chunk;
			});

			res.on("end", function(){
				data = JSON.parse(body);
				promise_Deferred.resolve({currency:currency, rate:data.result});
			});	
		})
		return promise;
	}
	var promises = [];
	var rates = [];
	for(var i=0;i<currencies.length;i++){
		var currency = currencies[i];
		var promise = getCurrency(currency, i);
		promises.push(promise);
		promise.then(function(rate){
			rates.push(rate);
		});
	}

	Q.allSettled(promises).then((result) => {
		var result = {success:true, result:rates};
		return res.send(result, 200);
	});
	
});
/**
 * Get the currency adjustment of the subcontractor
 * @url http://test.njs.remotestaff.com.au/currency-adjustments/get-currency-adjustment-subcon/
 */
router.all("/get-currency-adjustment-subcon",function(req,res,next){
	if (typeof req.query.subcon_id == "undefined"){
		return res.status(200).send({success:false, errors:"Missing Subcontractors ID"});
	}

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod"); 	
 	var Subcontractor = db.model("Subcontractor", subcontractorSchema);
	db.once("open", function(){
		Subcontractor.findOne({subcontractors_id:parseInt(req.query.subcon_id)}).exec((err, subcontractor) => {
			db.close();
			if (typeof req.query.forex_rate == "undefined"){
				subcontractor.getCurrencyAdjustment().then((currency_adjustment) => {
					return res.status(200).send({success:true, result:currency_adjustment});
				});
			}else{
				subcontractor.getCurrencyAdjustment(parseFloat(req.query.forex_rate)).then((currency_adjustment) => {
					return res.status(200).send({success:true, result:currency_adjustment});
				});
			}

		});
	});
});


/*
 * Method in getting the history logs of Currency Rates
 * @url /currency-adjustments/history
 *
 * */
router.get("/history", function(req,res,next) {

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/currency_adjustments", mongoCredentials.options);
    var CurrencyRateHistorySchema = require("../models/CurrencyRateHistory");

    var CurrencyRateHistory = db.model("CurrencyRateHistory", CurrencyRateHistorySchema);


    db.once('open', function () {
    	var history_fetcher = new CurrencyRateHistory();
    	history_fetcher.db = db;
        history_fetcher.fetchAllHistory().then(function(histories){

            // echo json_encode(array('success' => true ,'histories' => $histories ));
            res.status(200).send({success: true, histories: histories});
		});
    });
});

/*
 * Method in Saving Currency Adjustment
 * @url http://text.njs.remotestaff.com.au/currency-adjustments/save
 *
 * @info From https://api.remotestaff.com.au/currency-adjustment/save/
 *
 * @url /currency-adjustment/save/
 * @param string $currency. ['AUD', 'GBP', 'USD']
 * @param float $rate.
 * @param string $effective_date. Date effectiveness of new currency adjustment rate
 * @param int $admin_id. Administrator id the one who save the new currency adjustment rate.
 * return string
 */
router.get("/save", function(req,res,next) {
    var CurrencyAdjComponent = require("../components/CurrencyAdjusment");

    CurrencyAdjComponent.save(req).then(function(result){
        res.status(200).send(result);
    });

});


/**
 * Syncs currency adjustment from xe.com
 * @url http://test.njs.remotestaff.com.au/currency-adjustments/sync-currency-adjustments-from-xe/
 *
 * @param string from_currency The currencies to be fetched
 * @param string to_currency The target currency
 * @param string formula The formula to be appended with from to_currency
 *
 * example:
 *
 * if to_currency == "PHP"
 * and formula == "-1"
 * then formula_to_use = eval(to_currency + formula)
 * this will equate to PHP-1
 *
 */
router.get("/sync-currency-adjustments-from-xe", function(req,res,next){


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

            var CurrencyAdjComponent = require("../components/CurrencyAdjusment");

            var data_to_send = {
                query: {
                    admin_id: 143,
                    currency: from_currency,
                    rate: final_rate,
                    effective_date: moment_tz().format("YYYY-MM-DD")
                }
            };

            CurrencyAdjComponent.save(data_to_send).then(function(currencyAdjustmentSavingResult){
                willDefer.resolve(currencyAdjustmentSavingResult);
            });

            console.log("Calling CurrencyAdjComponent.save");
            // var njsUrl = "http://127.0.0.1:3000";
            //
            // var request_str = njsUrl + '/currency-adjustments/save/?admin_id=143&currency=' + from_currency + "&rate=" + final_rate + "&effective_date=" + moment_tz().format("YYYY-MM-DD");
            // console.log("calling " + request_str);
            //
            // http.get(request_str, callback);

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

            function evaluateRateFromXE(current_rate_from_xe){

                var willDefer = Q.defer();
                var willFullfil = willDefer.promise;

                var to_currency_rate = current_rate_from_xe.mid;
                console.log("original: " + to_currency_rate);
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
            if(!xe_response.to){
            	//save xe.com error
                var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/currency_adjustments", mongoCredentials.options);
                var CurrencyRateHistorySchema = require("../models/CurrencyRateHistory");

                var CurrencyRateHistory = db.model("CurrencyRateHistory", CurrencyRateHistorySchema);
                db.once('open', function () {

                    var mongo_data = {
                        currency: from_currency,
                        rate: null,
                        date_added: configs.getDateToday(),
                        effective_date: moment_tz().format("YYYY-MM-DD"),
                        admin_id: 143,
                        admin: "Allanaire Tapion",
                        log: "XE.com error: " + xe_response.message
                    };


                    var mongo_history = new CurrencyRateHistory(mongo_data);

                    mongo_history.save(function(err){
                    	if(err){
                    		console.log("Error saving to currency_rate_history");
                    		console.log(err);
						}
                        db.close();
                        willFullFillDefer.resolve(mongo_history);
                    });
                });

			} else{
                var current_rate_from_xe = xe_response.to[0];

                var evaluation_promise = evaluateRateFromXE(current_rate_from_xe);

                evaluation_promise.then(function(ca_result){
                    willFullFillDefer.resolve(ca_result);
                });
			}

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