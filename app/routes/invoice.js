var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Q = require('q');
var http = require("http");
var swig  = require('swig');
http.post = require("http-post");

//import ClientsSchema
var clientSchema = require("../models/Client");
var invoiceSchema = require("../models/Invoice");
var emailInvoiceSchema = require("../models/EmailInvoice");
var notesSchema = require("../models/Notes");
var invoiceVersionSchema = require("../models/InvoiceVersion");
var availableBalanceSchema = require("../models/AvailableBalance");
var invoicePaymentsSchema = require("../models/InvoicePayments");
var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});


function supportCrossOriginScript(req, res, next) {
    res.status(200);
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
}


// Support CORS
router.options('/invoice-payments', supportCrossOriginScript);

/*
 * Receive payment, Updating paid_date and setting status to PAID
 * TO DO add client running balance
 * @url http://test.njs.remotestaff.com.au/invoice/invoice-payments/
 */
router.post("/invoice-payments", supportCrossOriginScript, function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var InvoicePayments = db.model("InvoicePayments", invoicePaymentsSchema);

	
	var numrows = 10;
 	var page = 0;
 	
	 
	if(typeof req.body.payment_mode == "undefined"){
		var result = {success:false, msg : "Payment mode is missing."};
		return res.send(result, 200);
	}

 	if(typeof req.body.page != "undefined"){
 		var page = parseInt(req.body.page);
 	}
	 
	var payment_mode = req.body.payment_mode;
 	var search_key = { payment_mode:payment_mode };
 	
	//var search_key = { payment_mode:"paypal" };

	console.log("Page => "+page);
 	console.log(search_key);
	db.once('open', function(){
		var clients=[];
		var promises = [];
		var pages = [];
		var total_num_docs = 0;
		InvoicePayments.find(search_key)
			
			.sort({ 'added_on' : 1})
			.exec(function(err, docs){

				if(err){
					db.close();
					var result = {success:false, msg : err};
					return res.send(result, 200);
				}
				
				//invoice_date = moment.utc(timestamp, "YYYY-MM-DD HH:mm:ss").toDate();
				var data=[];
				for(var i=0; i<docs.length; i++){
					var doc = docs[i];
					
					//console.log(doc.order_id);
					var response_data={};
					if((typeof doc.response != "undefined") && doc.response != null ){
						var response = doc.response;
						var PAYMENTINFO_0_ORDERTIME = null;
						var PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE = null;

						//console.log("Order Date/Time : " + response[0].PAYMENTINFO_0_ORDERTIME);
						//console.log("Clear Date : "+ response[0].PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE);
						if(response[0].PAYMENTINFO_0_ORDERTIME){
							PAYMENTINFO_0_ORDERTIME = moment.utc(response[0].PAYMENTINFO_0_ORDERTIME).toDate();
						}

						if(response[0].PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE){
							PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE = moment.utc(response[0].PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE).toDate();
						}
						response_data = {
							PAYMENTINFO_0_ORDERTIME : PAYMENTINFO_0_ORDERTIME,
							PAYMENTINFO_0_TRANSACTIONID : response[0].PAYMENTINFO_0_TRANSACTIONID,
							PAYMENTINFO_0_TRANSACTIONTYPE :  response[0].PAYMENTINFO_0_TRANSACTIONTYPE,
							PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE : PAYMENTINFO_0_EXPECTEDECHECKCLEARDATE,
							PAYMENTINFO_0_PAYMENTTYPE : response[0].PAYMENTINFO_0_PAYMENTTYPE	
						};

					}
					
					
					
					data.push({
						doc: {
							couch_id : doc.couch_id,
							order_id : doc.order_id,
							client_id : doc.client_id,
							currency : doc.currency,
							payment_mode : doc.payment_mode,
							total_amount : doc.total_amount,
							client_fname :  doc.doc_order[0].client_fname,
							client_lname :  doc.doc_order[0].client_lname
						},
						response : response_data,
					});
					//break;
				}
				var result = {
					success:true,
					docs : data,
					total_docs : docs.length
				};
				return res.send(result, 200);

		});
		// InvoicePayments.count(search_key, function(err, count) {
		// 	console.log('Total number of docs is ' + count);
        // 	var total_num_docs =  count;


        // 	InvoicePayments.find(search_key)
		// 		.limit(numrows)
		// 		.skip(numrows * page)
		// 		.sort({ 'added_on' : 1})
		// 		.exec(function(err, docs){

		// 			if(err){
		// 				db.close();
		// 	    		var result = {success:false, msg : err};
		// 				return res.send(result, 200);
		// 			}
					
		// 			var numpages = Math.ceil(total_num_docs / numrows);
		// 			var next_page = 0;
		// 			if( (page + 1) < numpages){
		// 				var next_page = page + 1;
		// 			}

		// 			var result = {
		// 				success:true,
		// 				docs : docs,
		// 				total_docs : total_num_docs,
		// 				next_page : next_page,
		// 				numrows : numrows,
		// 				numpages : numpages
		// 			};
		// 			return res.send(result, 200);

        // 	});
		// });
	});
	
});

function fetchInvoiceDetails(mongo_id){

	var ultimate_defer = Q.defer();

    var nano = configs.getCouchDb();
    var mailbox = nano.use("mailbox");
    var couch_db = nano.use("client_docs");

    var emailInvoiceSchema = require("../models/EmailInvoice");
    var leads_info_schema = require("../mysql/Lead_Info");

    var db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);
    var InvoiceReporting = db_invoice.model("InvoiceEmailReporting", emailInvoiceSchema);
    var InvoiceReportingObj = new InvoiceReporting();

    var date_delivered = null;

    db_invoice.once("open", function(){
        db_invoice.close();
    });

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
    var Invoice = db.model("Invoice", invoiceSchema);

    var today = moment_tz().tz("GMT");
    var atz = today.clone().tz("Asia/Manila");
    var added_on = atz.toDate();

    var search_key={"_id" : mongo_id};

    var fs = require('fs');
    var pdf = require('html-pdf');

    db.once('open', function(){
        var promises = [];

        Invoice.findOne(search_key).exec(function(err, doc){

            if(err){
                db.close();
                var result = {success:false};
                return res.send(result, 200);
            }

            for(var i=0; i<doc.items.length; i++){
                if(doc.items[i].start_date){
                    doc.items[i].start_date = moment(doc.items[i].start_date).format("MMM DD, YYYY");
                }

                if(doc.items[i].end_date){
                    doc.items[i].end_date = moment(doc.items[i].end_date).format("MMM DD, YYYY");
                }

                if(doc.items[i].unit_price){
                    doc.items[i].unit_price = doc.items[i].unit_price.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
                }

                if(doc.items[i].amount){
                    doc.items[i].amount = doc.items[i].amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
                }
            }


            if(doc.sub_total){
                doc.sub_total_string = doc.sub_total.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
            }

            if(doc.gst_amount){
                doc.gst_amount_string = doc.gst_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
            }

            if(doc.total_amount){
                doc.total_amount_string = doc.total_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
            }

            var per_promise = [];
            function delay(){ return Q.delay(100); }

            doc.db = db;



            //Get Client Basic Info
            var promise_client_basic_info = doc.getClientInfo();

            //Get Client Current Available Balance
            var promise_running_balance = doc.getCouchdbAvailableBalance();


            per_promise.push(promise_client_basic_info);
            per_promise.push(delay);

            per_promise.push(promise_running_balance);
            per_promise.push(delay);

            //Check all settled promises
            per_promises_promise = Q.allSettled(per_promise);
            promises.push(per_promises_promise);
            promises.push(delay);

            var allPromise = Q.allSettled(promises);

            allPromise.then(function(results){


                InvoiceReportingObj.getOneData(doc.order_id, true).then(function(foundEmailReport){
                    if(doc.added_on){
                        doc.added_on_ordinal_string = moment(doc.added_on).format("MMMM DD, YYYY");
                    }


                    if(doc.pay_before_date){
                        doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("Do [of] MMMM YYYY");
                    }

                    if(foundEmailReport){
                        doc.date_delivered_string = moment(foundEmailReport.date_delivered).format("MMMM DD, YYYY");
					}

                    leads_info_schema.getClientInfo(doc.client_id).then(function(fetchedClientInfo){
                        db.close();
                    	try{
                            if(fetchedClientInfo[0]){
                                doc.client_abn_number = fetchedClientInfo[0].abn_number;
                            }
                            ultimate_defer.resolve({doc: doc, results:results});
						} catch(major_error){
                    		console.log(major_error);
						}
                    });

                });
            });


        });

    });



    return ultimate_defer.promise;
}

/*
 * Send invoice via email wth attachment per recipient depending on the client email invoice settings
 * @url http://test.njs.remotestaff.com.au/invoice/export-pdf-invoice/?mongo_id=57445529531007b54a8b4567 
 * */
router.all("/export-pdf-invoice", function(req,res,next){
	var mongo_id = req.query.mongo_id;
	//console.log("mongo_id " + mongo_id);
	
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();
	
	var search_key={"_id" : mongo_id};
	
	var fs = require('fs');
	var pdf = require('html-pdf');

    fetchInvoiceDetails(mongo_id).then(function(fetchedDetails){

    	var doc = fetchedDetails.doc;
    	var results = fetchedDetails.results;

        //Create HTML File
        doc.createHTMLInvoice().then(function(html_file){

            //console.log(doc.order_id);

            var pdf_filename = "invoice-"+doc.order_id+".pdf";
            var html = fs.readFileSync(html_file, 'utf8');

            pdf.create(html).toBuffer(function (err, buffer) {
                if (err) return res.send(err);

                fs.unlink(html_file, function(err) {
                    if (err) {
                        return console.error(err);
                    }
                    //console.log("Deleted "+html_file);
                });

                //db.close();
                //console.log(pdf_filename);
                //res.type('pdf');
                res.writeHead(200, {
                    'Content-Type': 'application/pdf',
                    'Access-Control-Allow-Origin': '*',
                    'Content-Disposition': 'attachment; filename='+pdf_filename
                });
                res.end(buffer, 'binary');
            });


        });
	});
	
	// db.once('open', function(){
	// 	var promises = [];
    //
	// 	Invoice.findOne(search_key).exec(function(err, doc){
	// 		if(err){
	// 			db.close();
	// 			var result = {success:false};
	// 			return res.send(result, 200);
	// 		}
	//		
	//		
	//	
	// 		for(var i=0; i<doc.items.length; i++){
	// 			if(doc.items[i].start_date){
	// 				doc.items[i].start_date = moment(doc.items[i].start_date).format("MMM DD, YYYY");
	// 			}
    //
	// 			if(doc.items[i].end_date){
	// 				doc.items[i].end_date = moment(doc.items[i].end_date).format("MMM DD, YYYY");
	// 			}
    //
	// 			if(doc.items[i].unit_price){
	// 				doc.items[i].unit_price = doc.items[i].unit_price.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 			}
    //
	// 			if(doc.items[i].amount){
	// 				doc.items[i].amount = doc.items[i].amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 			}
	// 		}
    //
	// 		if(doc.sub_total){
	// 			doc.sub_total_string = doc.sub_total.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 		}
    //
	// 		if(doc.gst_amount){
	// 			doc.gst_amount_string = doc.gst_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 		}
    //
	// 		if(doc.total_amount){
	// 			doc.total_amount_string = doc.total_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 		}
    //
	// 		var per_promise = [];
	// 		function delay(){ return Q.delay(100); }
    //
	// 		doc.db = db;
    //
    //
	// 		//Get Client Basic Info
	// 		var promise_client_basic_info = doc.getClientInfo();
    //
	// 		//Get Client Current Available Balance
	// 		var promise_running_balance = doc.getCouchdbAvailableBalance();
    //
	// 		per_promise.push(promise_client_basic_info);
	// 		per_promise.push(delay);
    //
	// 		per_promise.push(promise_running_balance);
	// 		per_promise.push(delay);
    //
	// 		//Check all settled promises
	// 		per_promises_promise = Q.allSettled(per_promise);
	// 		promises.push(per_promises_promise);
	// 		promises.push(delay);
    //
	// 		var allPromise = Q.allSettled(promises);
	// 		allPromise.then(function(results){
	//			
	// 			//Create HTML File
	// 			doc.createHTMLInvoice().then(function(html_file){					
	//				
	// 				//console.log(doc.order_id);	
    //
	// 				var pdf_filename = "invoice-"+doc.order_id+".pdf";						
	// 				var html = fs.readFileSync(html_file, 'utf8');
    //
	// 				pdf.create(html).toBuffer(function (err, buffer) {
	// 					if (err) return res.send(err);
    //
	// 					fs.unlink(html_file, function(err) {
	// 						if (err) {
	// 							return console.error(err);
	// 						}
	// 						//console.log("Deleted "+html_file);
	// 					});
    //
	// 					db.close();
	// 					//console.log(pdf_filename);
	// 					//res.type('pdf');
	// 					res.writeHead(200, {
	// 						'Content-Type': 'application/pdf',
	// 						'Access-Control-Allow-Origin': '*',
	// 						'Content-Disposition': 'attachment; filename='+pdf_filename
	// 					});
	// 					res.end(buffer, 'binary');
	// 				});
    //
	//				
	// 			});
	// 		});
	// 	});
	// });

});

/**
 * Return Html for printing (top-up page)
 * @url http://test.njs.remotestaff.com.au/invoice/print-pdf-invoice?{{mongo_id}}
 */

router.all("/print-pdf-invoice", function(req,res,next){
	var mongo_id = req.query.mongo_id;
	//console.log("mongo_id " + mongo_id);

    var leads_info_schema = require("../mysql/Lead_Info");

	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

    var emailInvoiceSchema = require("../models/EmailInvoice");

    var db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);
    var InvoiceReporting = db_invoice.model("InvoiceEmailReporting", emailInvoiceSchema);
    var InvoiceReportingObj = new InvoiceReporting();

    var date_delivered = null;

    db_invoice.once("open", function(){
        db_invoice.close();
	});


	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();

	var search_key={"_id" : mongo_id};

	var fs = require('fs');
	var pdf = require('html-pdf');


    fetchInvoiceDetails(mongo_id).then(function(fetchedDetails) {

        var doc = fetchedDetails.doc;
        var results = fetchedDetails.results;


        //Create HTML File
        doc.createHTMLInvoice(true).then(function(html_file){
            //db.close();
            return res.status(200).send({success:true,data:html_file});
        });
    });
	// try {
	// 	db.once('open', function(){
    //
     //        var promises = [];
    //
	// 		Invoice.findOne(search_key).exec(function(err, doc){
	// 			if(err){
	// 				db.close();
	// 				var result = {success:false};
	// 				return res.send(result, 200);
	// 			}
    //
	// 			for(var i=0; i<doc.items.length; i++){
	// 				if(doc.items[i].start_date){
	// 					doc.items[i].start_date = moment(doc.items[i].start_date).format("MMM DD, YYYY");
	// 				}
    //
	// 				if(doc.items[i].end_date){
	// 					doc.items[i].end_date = moment(doc.items[i].end_date).format("MMM DD, YYYY");
	// 				}
    //
	// 				if(doc.items[i].unit_price){
	// 					doc.items[i].unit_price = doc.items[i].unit_price.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 				}
    //
	// 				if(doc.items[i].amount){
	// 					doc.items[i].amount = doc.items[i].amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 				}
	// 			}
    //
	// 			if(doc.sub_total){
	// 				doc.sub_total_string = doc.sub_total.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 			}
    //
	// 			if(doc.gst_amount){
	// 				doc.gst_amount_string = doc.gst_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 			}
    //
	// 			if(doc.total_amount){
	// 				doc.total_amount_string = doc.total_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
	// 			}
    //
	// 			var per_promise = [];
	// 			function delay(){ return Q.delay(100); }
    //
	// 			doc.db = db;
    //
    //
	// 			//Get Client Basic Info
	// 			var promise_client_basic_info = doc.getClientInfo();
    //
	// 			//Get Client Current Available Balance
	// 			var promise_running_balance = doc.getCouchdbAvailableBalance();
    //
	// 			per_promise.push(promise_client_basic_info);
	// 			per_promise.push(delay);
    //
	// 			per_promise.push(promise_running_balance);
	// 			per_promise.push(delay);
    //
	// 			//Check all settled promises
	// 			per_promises_promise = Q.allSettled(per_promise);
	// 			promises.push(per_promises_promise);
	// 			promises.push(delay);
    //
	// 			var allPromise = Q.allSettled(promises);
	// 			allPromise.then(function(results){
    //
     //                InvoiceReportingObj.getOneData(doc.order_id, true).then(function(foundEmailReport){
     //                    if(doc.added_on){
     //                        doc.added_on_ordinal_string = moment(doc.added_on).format("MMMM DD, YYYY");
     //                    }
    //
    //
     //                    if(doc.pay_before_date){
     //                        doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("Do [of] MMMM YYYY");
     //                    }
    //
     //                    doc.date_delivered_string = moment(foundEmailReport.date_delivered).format("MMMM DD, YYYY");
    //
    //
     //                    leads_info_schema.getClientInfo(doc.client_id).then(function(fetchedClientInfo){
     //                    	if(fetchedClientInfo[0]){
     //                    		doc.client_abn_number = fetchedClientInfo[0].abn_number;
	// 						}
	// 						//Create HTML File
     //                        doc.createHTMLInvoice(true).then(function(html_file){
     //                            db.close();
     //                            return res.status(200).send({success:true,data:html_file});
     //                        });
     //                    });
    //
	// 				});
    //
	// 			});
	// 		});
	// 	});
	// }catch(e)
	// {
	// 	console.log(e);
	// 	return res.status(200).send({success:false,data:null});
	// }


});


/**
 * Remove Duplicates
 * @url http://test.njs.remotestaff.com.au/invoice/remove-duplicates/
 */

router.all("/remove-duplicates", function(req, res, next){
	console.log("Test!!!");


	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod" , mongoCredentials.options);
	var Invoice = db.model("Invoice", invoiceSchema);
	db.once('open', function(){
		console.log("connected");

		Invoice.find().exec(function(err, invoices){
			console.log("Invoice Found");
			function checkDuplicate(invoice){
				var deferred_promise = Q.defer();
				var promise = deferred_promise.promise;
				Invoice.find({couch_id:invoice.couch_id}).exec(function(err, rows){
					deferred_promise.resolve({count:rows.length, couch_id:invoice.couch_id});
				});
				return promise;
			}
			
			var promises = [];
			var listInvoice = [];
			for(var i=0;i<invoices.length;i++){
				var invoice = invoices[i];
				var promiseInvoice = checkDuplicate(invoice);
				promiseInvoice.then(function(response){
					if (response.count > 1){
						console.log(response.couch_id);
						listInvoice.push(response.couch_id);
					}
				});
				promises.push(promiseInvoice);
			}

			Q.allSettled(promises).then(function(){
				db.close();
				return res.status(200).send({success:true, result:listInvoice});
			});



		});
	});
	return res.status(200).send({success:true});
			
});

/*
 * Search Active Clients
 * @url http://test.njs.remotestaff.com.au/invoice/search
 * @param int id
 */

router.post("/search", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var AvailableBalance = db.model("AvailableBalance", availableBalanceSchema);
 	var numrows = 50;
 	var page = 0;
	var search_key = {};

	if(req.body){
		//var keyword = req.body.keyword;
		var page = parseInt(req.body.page);
		var keyword = "";
		var exclude_old_client = req.body.exclude_old_client;
		var client_status = req.body.client_status;
		console.log(client_status);


		var client_status_str =[];
		if(client_status == "all"){
			client_status_str.push("active");
			client_status_str.push("inactive");
		}else{
			client_status_str.push(client_status);
		}

		//exclude client that has a value of days_before_suspension = -30
		if(exclude_old_client == "yes"){
			var days_before_suspension = -30;
		}else{
			var days_before_suspension = null;
		}

		search_key = { client_status: { $in: client_status_str}, days_before_suspension:{ $ne: days_before_suspension} };



		if (typeof req.body.keyword == "undefined" || req.body.keyword ==""){
			//do nothing
		}else{
			var keyword = req.body.keyword;
			keyword = keyword.toLowerCase();
			search_key = { full_content: {$in: [keyword]} , client_status: { $in: client_status_str}, days_before_suspension:{ $ne: days_before_suspension} };
		}



	}

 	console.log("Page => "+page);
 	console.log(search_key);
	db.once('open', function(){
		var clients=[];
		var promises = [];
		var pages = [];
		var total_num_docs = 0;

		AvailableBalance.count(search_key, function(err, count) {
			console.log('Total number of docs is ' + count);
        	var total_num_docs =  count;


        	AvailableBalance.find(search_key)
				.limit(numrows)
				.skip(numrows * page)
				.sort({ 'available_balance' : 1})
				.exec(function(err, docs){

					if(err){
						db.close();
			    		var result = {success:false, msg : err};
						return res.send(result, 200);
					}
					delete docs.full_content;
					var numpages = Math.ceil(total_num_docs / numrows);
					var next_page = 0;
					if( (page + 1) < numpages){
						var next_page = page + 1;
					}

					var result = {
						success:true,
						clients : docs,
						total_docs : total_num_docs,
						next_page : next_page,
						numrows : numrows,
						numpages : numpages
					};
					return res.send(result, 200);

        	});
		});
	});

});


/*
 * Get client new invoices that are not yet been paid
 * @url http://test.njs.remotestaff.com.au/invoice/get-client-invoices/
 * @param int id
 */
router.all("/get-client-invoices", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var Client = db.model("Client", clientSchema);

	var search_key = {};
	if(req.query.id){
		var id = parseInt(req.query.id);
		search_key={client_id:id};
	}



	db.once('open', function(){
		var client=[];
		var promises = [];

		Client.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}

			function client_output(){}
        	var temp = new client_output();
        	var per_client_promises = [];
		    function delay(){ return Q.delay(100); }

		    doc.db = db;

		    var promise_running_balance = doc.getCouchdbAvailableBalance();
	        var promise_all_invoice = doc.getInvoices("all", false);
	        var promise_daily_rate = doc.getClientDailyRate();
			var promise_client_assigned_sc = doc.getClientAssignedSC();	


        	per_client_promises.push(promise_running_balance);
        	per_client_promises.push(delay);
        	per_client_promises.push(promise_all_invoice);
        	per_client_promises.push(delay);
        	per_client_promises.push(promise_daily_rate);
        	per_client_promises.push(delay);
			per_client_promises.push(promise_client_assigned_sc);
        	per_client_promises.push(delay);



        	per_client_promises_promise = Q.allSettled(per_client_promises);
        	promises.push(per_client_promises_promise);
        	promises.push(delay);


        	var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){
				//console.log("All promises done!");
				//console.log(results);

				client = doc.getAllClientInvoice();


				var result = {success:true, result : client};
				//console.log(result);
				db.close();
				return res.send(result, 200);
			});




		});

	});

});


/*
 * Get client new invoices that are not yet been paid
 * @url http://test.njs.remotestaff.com.au/invoice/add-client-account-notes/
 * @param int id
 */
router.post("/add-client-account-notes", function(req,res,next){
	var ObjectID = require('mongodb').ObjectID;

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice");
	var doc = {};

	if(req.body){
		var admin_id = parseInt(req.body.admin_id);
		var client_id = parseInt(req.body.client_id);
		var admin = req.body.admin;
		var note = req.body.note;

		var doc = {
	  		_id: new ObjectID(),
	  		client_id : client_id,
	  		admin_id : admin_id,
	  		admin : admin,
	  		note : note,
	  		date_created : new Date()
		};
	}

	db.once('open', function(){
		db.collection('client_account_notes').insert(doc, callback);
		function callback(err, docs) {
		    if (err) {
		        console.log(err);
		        db.close();
		        var result = {success:false, error : err};
				return res.send(result, 200);
		    } else {

		        db.close();
				var result = {success:true, msg : "created"};
				return res.send(result, 200);
		    }
		}
	});
});

// Support CORS
router.options('/update-commission', supportCrossOriginScript);
/*
 * After Receive payment, Updating commission
 * @url http://test.njs.remotestaff.com.au/invoice/update-commission/?mongo_id=588ee5fad8bc9826383f4dc2
 */
router.all("/update-commission", supportCrossOriginScript, function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	
	var search_key={"_id" : req.query.mongo_id};
	//console.log(req.query.admin_id);
	//console.log(req.query.admin);
	//var result = {success:true};
	//return res.send(result, 200);	
					
	db.once('open', function(){		
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}
			
			var history = doc.history;
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
			
			
			doc.updateCommission(req.query.admin_id).then(function(items){
				//console.log(items);				
				for(var i=0; i<items.length; i++){
					//console.log(items[i]);
					history.push({
						timestamp : timestamp,
						changes : "processed commission_id "+items[i],
						by : "nodejs /invoice/update-commission by Admin "+req.query.admin
					});
				}
				
				doc.history = history;
				//console.log(doc.history);
				doc.save(function(err, updated_doc){
					if (err){
						console.log(err);
						db.close();
						var result = {success:false, error : err};
						return res.send(result, 200);
					}
					console.log("added history in mongodb for commission");
					
					couch_db.get(doc.couch_id, function(err, couch_doc) {
						updaterev = couch_doc._rev;
						couch_doc._rev = updaterev;
						
						var today = moment_tz().tz("GMT");
						var atz = today.clone().tz("Asia/Manila");
						var timestamp = atz.toDate();

						var history = couch_doc.history;
						for(var i=0; i<items.length; i++){							
							history.push({
								timestamp : timestamp,
								changes : "processed commission_id "+items[i],
								by : "nodejs /invoice/update-commission by Admin "+req.query.admin
							});
						}
						couch_doc.history = history;
						couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
							if (err){
								console.log(err.error);
								db.close();
								var result = {success:false, error : err.error};
								return res.send(result, 200);
							}
							
							console.log("added history in couchdb for commission");
						});
					});
					
					var result = {success:true};
					return res.send(result, 200);		
					
				});
			});
		});
	});
});


// Support CORS
router.options('/add-payment', supportCrossOriginScript);

/*
 * Receive payment, Updating paid_date and setting status to PAID
 * TO DO add client running balance
 * @url http://test.njs.remotestaff.com.au/invoice/add-payment/
 */
router.post("/add-payment", supportCrossOriginScript, function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	//Update mongodb
	//var search_key={couch_id : req.body.couch_id};
	var search_key={"_id" : req.body.mongo_id};
	db.once('open', function(){
		var promises = [];
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}

		  	var per_promise = [];
		    function delay(){ return Q.delay(100); }

		  	doc.db = db;
		  	doc.credit = req.body.amount;

		  	if (typeof req.body.account_type == "undefined" || req.body.account_type ==""){
				doc.credit_type = "";
			}else{
				doc.credit_type = req.body.account_type;
			}

		  	if (typeof req.body.particular == "undefined" || req.body.particular ==""){
				doc.particular = "";
			}else{
				doc.particular = req.body.particular;
			}

			if (typeof req.body.remarks == "undefined" || req.body.remarks ==""){
		  		doc.remarks = "";
			}else{
		  		doc.remarks = req.body.remarks;
			}


		  	doc.status = "paid";
		  	doc.date_paid = req.body.payment_date;
		  	doc.by = "Admin " + req.body.admin;
			doc.admin_id = req.body.admin_id;  

		  	var history = doc.history;
	        var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

	        history.push({
	        	timestamp : timestamp,
	        	changes : "Set status to paid and set date_paid to "+req.body.payment_date,
	        	by : "Admin "+req.body.admin
	        });
	        doc.history = history;

		  	//Get Client Basic Info
		  	var promise_client_basic_info = doc.getClientInfo();

		  	//Update document in mongodb
		  	var promise_mongodb_save = doc.saveMongodbPayment();

		  	//Update document in couchdb
		  	var promise_couchdb_save = doc.saveCouchdbPayment();


		  	//Insert new document in mongodb = prod.client_running_balance
		  	var promise_save_running_balance = doc.saveRunningBalance();

		  	//Check if the amount entered is greater than the Invoie total_amount.
		  	var promise_over_payment = doc.saveOverPayment();

		  	//Generate new invoice is overpayment
		  	var promise_new_invoice = doc.generateNewInvoice();


		  	per_promise.push(promise_client_basic_info);
		    per_promise.push(delay);

		  	per_promise.push(promise_mongodb_save);
		    per_promise.push(delay);

		    per_promise.push(promise_couchdb_save);
		    per_promise.push(delay);

		    per_promise.push(promise_save_running_balance);
		    per_promise.push(delay);

	    	per_promise.push(promise_over_payment);
	    	per_promise.push(delay);

	    	per_promise.push(promise_new_invoice);
	    	per_promise.push(delay);


		    //Check all settled promises
		    per_promises_promise = Q.allSettled(per_promise);
		    promises.push(per_promises_promise);
		    promises.push(delay);


		    var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){

				//Check for items that are need to be charge in Running Balance of the client.
				doc.insertItemsInRunningBalance();

				http.get("http://127.0.0.1:3000"+"/invoice/update-commission/?mongo_id="+req.body.mongo_id+"&admin="+req.body.admin+"&admin_id="+req.body.admin_id, (res) => {
					res.setEncoding('utf-8')
					var body = '';
					res.on('data', function(chunk){
						body += chunk;
					});
					res.on("end", function(){
						data = JSON.parse(body);
						console.log(data);					
					});
				});

				db.close();
				var result = {success:true, invoice : doc};
				return res.send(result, 200);
			});

		});
	});
});



/*
 * Set the cancelled Invoice status to new
 * @url http://test.njs.remotestaff.com.au/invoice/update-status-invoice-new/
 */
router.post("/update-status-invoice-new", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);



	//Update mongodb
	var search_key={"_id" : req.body.mongo_id};
	db.once('open', function(){
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}

		  	doc.status = "new";
		  	//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
		  	var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

		  	doc.date_cancelled_to_new = timestamp;
		  	var history = doc.history;
			var changes =   "Updated invoice status from cancelled to new";
	        history.push({
	        	timestamp : timestamp,
	        	changes : changes,
	        	by : "Admin "+req.body.admin
	        });
	        doc.history = history;


		  	//Update mongodb
		  	doc.save(function(err, updated_doc){

		  		if (err){
			  		console.log(err);
			  		db.close();
		        	var result = {success:false, error : err};
					return res.send(result, 200);
			  	}

			  	//Update Couchdb
				couch_db.get(req.body.couch_id, function(err, couch_doc) {
			        updaterev = couch_doc._rev;
			        couch_doc._rev = updaterev;
			        couch_doc.status = "new";

			        //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
			        var today = moment_tz().tz("GMT");
					var atz = today.clone().tz("Asia/Manila");
					var timestamp = atz.toDate();

			        couch_doc.date_cancelled_to_new = timestamp;
			        couch_doc.mongo_synced = false;
			        var history = couch_doc.history;
			        history.push({
			        	timestamp : timestamp,
			        	changes : changes,
			        	by : "Admin "+req.body.admin
			        });
			        couch_doc.history = history;
			        couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
			            if (err){
			                console.log(err.error);
			                db.close();
			                var result = {success:false, error : err.error};
							return res.send(result, 200);
			            }
			        });
			  	});

			  	//display output
			  	db.close();
		        var result = {success:true,  msg : "Invoice status has been set to new" , invoice : updated_doc};
				return res.send(result, 200);

		  	});

		});
	});

});
/*
 * Cancel Invoice
 * @url http://test.njs.remotestaff.com.au/invoice/cancel-invoice/
 */
router.post("/cancel-invoice", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);



	//Update mongodb
	var search_key={"_id" : req.body.mongo_id};
	db.once('open', function(){
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}

		  	doc.status = "cancelled";
		  	//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
		  	var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

		  	doc.date_cancelled = timestamp;
		  	var history = doc.history;

	        history.push({
	        	timestamp : timestamp,
	        	changes : "Set status to cancelled",
	        	by : "Admin "+req.body.admin
	        });
	        doc.history = history;


		  	//Update mongodb
		  	doc.save(function(err, updated_doc){

		  		if (err){
			  		console.log(err);
			  		db.close();
		        	var result = {success:false, error : err};
					return res.send(result, 200);
			  	}

			  	//Update Couchdb
				couch_db.get(req.body.couch_id, function(err, couch_doc) {
			        updaterev = couch_doc._rev;
			        couch_doc._rev = updaterev;
			        couch_doc.status = "cancelled";

			        //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
			        var today = moment_tz().tz("GMT");
					var atz = today.clone().tz("Asia/Manila");
					var timestamp = atz.toDate();

			        couch_doc.date_cancelled = timestamp;
			        couch_doc.mongo_synced = false;
			        var history = couch_doc.history;
			        history.push({
			        	timestamp : timestamp,
			        	changes : "Set status to cancelled",
			        	by : "Admin "+req.body.admin
			        });
			        couch_doc.history = history;
			        couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
			            if (err){
			                console.log(err.error);
			                db.close();
			                var result = {success:false, error : err.error};
							return res.send(result, 200);
			            }
			        });
			  	});

			  	//display output
			  	db.close();
		        var result = {success:true,  msg : "Invoice has been cancelled" , invoice : updated_doc};
				return res.send(result, 200);

		  	});

		});
	});

});


/*
 * Get client new invoices that are not yet been paid
 * @url http://test.njs.remotestaff.com.au/invoice/get-client-account-notes/
 * @param int id
 */
router.all("/get-client-account-notes", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice");
	var Notes = db.model("Notes", notesSchema);

	var search_key = {};

	if(req.query.id){
		var id = req.query.id;
		console.log("req.query.id => " + req.query.id);
		search_key={client_id:id};
	}

	db.once('open', function(){
		Notes.find(search_key).exec(function(err, docs){
			if (!err){
				db.close();
		    	var result = {success:true, docs : docs };
				return res.send(result, 200);
		    } else {
		    	db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}
		});
	});

});





/*
 * Get invoice details by order_id
 * @url http://test.njs.remotestaff.com.au/invoice/get-invoice-details/?order_id=9548-00000049
 * @param int id
 */
router.all("/get-invoice-details", function(req,res,next){
	var db;
	var invoiceSchema  = require("../models/Invoice");
	db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	///db = mongoose.connection;
	var Invoice = db.model("Invoice", invoiceSchema);

	var search_key = {};


	if(req.query.order_id){
		var order_id = req.query.order_id;
		console.log("req.query.order_id => " + req.query.order_id);
		search_key={order_id:order_id};
	}

	db.once('open', function(){
		var promises = [];
		Invoice.findOne(search_key).exec(function(err, doc){
			//console.log(doc);
			var per_promise = [];
			function delay(){ return Q.delay(100); }

			if(err){
				db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}

			var promise_client_basic_info = doc.getClientInfo();
			var promise_client_assigned_sc = doc.getClientAssignedSC2();

			per_promise.push(promise_client_basic_info);
			per_promise.push(delay);

			per_promise.push(promise_client_assigned_sc);
			per_promise.push(delay);

			//Check all settled promises
			per_promises_promise = Q.allSettled(per_promise);
			promises.push(per_promises_promise);
			promises.push(delay);

			var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){
				var client_basic_info = doc.client_basic_info;
				var staffing_consultant = doc.staffing_consultant;
				db.close();
		    	var result = {	
					success : true, 
					result : doc, 
					client_basic_info : client_basic_info,
					staffing_consultant : staffing_consultant
				};
				return res.send(result, 200);	
			});


		});
	});

});


/*
 * Cancel Invoice
 * @url http://test.njs.remotestaff.com.au/invoice/add-invoice-comment/
 */
router.post("/add-invoice-comment/", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	//Update mongodb
	var search_key={"_id" : req.body.mongo_id};
	db.once('open', function(){
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}


		  	//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
		  	var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

		  	if (typeof doc.comments != "undefined"){
        		var comments = doc.comments;
        	}else{
        		var comments = new Array();
        	}
        	console.log(comments);

	        comments.push({
	        	date : timestamp,
	        	comment : req.body.comment,
	        	name : req.body.admin
	        });
	        doc.comments = comments;

		  	console.log(doc.comments);
		  	//Update mongodb
		  	doc.save(function(err, updated_doc){

		  		if (err){
			  		console.log(err);
			  		db.close();
		        	var result = {success:false, error : err};
					return res.send(result, 200);
			  	}



			  	//Update Couchdb
				couch_db.get(req.body.couch_id, function(err, couch_doc) {
			        updaterev = couch_doc._rev;
			        couch_doc._rev = updaterev;


			        //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
			        var today = moment_tz().tz("GMT");
					var atz = today.clone().tz("Asia/Manila");
					var timestamp = atz.toDate();

			        couch_doc.mongo_synced = false;
			        if (typeof couch_doc.comments != "undefined"){
		        		var comments = couch_doc.comments;
		        	}else{
		        		var comments = [];
		        	}

			        comments.push({
			        	date : timestamp,
			        	comment : req.body.comment,
			        	name : req.body.admin
			        });
			        couch_doc.comments = comments;

			        couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
			            if (err){
			                console.log(err.error);
			                db.close();
			                var result = {success:false, error : err.error};
							return res.send(result, 200);
			            }
			        });
			  	});



			  	//display output
			  	db.close();
		        var result = {success:true,  msg : "Invoice note has been added" , comments : updated_doc.comments};
				return res.send(result, 200);

		  	});

		});
	});

});


/*
 * Disable Auto Follow Up of Invoice
 * @url http://test.njs.remotestaff.com.au/invoice/disable-auto-follow-up/
 */
router.post("/disable-auto-follow-up", function(req,res,next){

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	//Update mongodb
	var search_key={"_id" : req.body.mongo_id};
	db.once('open', function(){
		Invoice.findOne(search_key, function(err, doc){
		  	if (err){
		  		console.log(err);
		  		db.close();
	        	var result = {success:false, error : err};
				return res.send(result, 200);
		  	}

		  	var orig_disable_auto_follow_up = doc.disable_auto_follow_up;
		  	doc.disable_auto_follow_up = req.body.disable_auto_follow_up;
		  	var history = doc.history;
	        //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
	        var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();
	        history.push({
	        	timestamp : timestamp,
	        	changes : "Updated disable_auto_follow_up from "+orig_disable_auto_follow_up+" to "+req.body.disable_auto_follow_up,
	        	by : "Admin "+req.body.admin
	        });
	        doc.history = history;


		  	//Update mongodb
		  	doc.save(function(err, updated_doc){

		  		if (err){
			  		console.log(err);
			  		db.close();
		        	var result = {success:false, error : err};
					return res.send(result, 200);
			  	}

			  	//Update Couchdb
				couch_db.get(req.body.couch_id, function(err, couch_doc) {
			        updaterev = couch_doc._rev;
			        couch_doc._rev = updaterev;

			        var orig_disable_auto_follow_up = couch_doc.disable_auto_follow_up;
		  			couch_doc.disable_auto_follow_up = req.body.disable_auto_follow_up;
			        couch_doc.mongo_synced = false;
			        var history = couch_doc.history;
			        //var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
			        var today = moment_tz().tz("GMT");
					var atz = today.clone().tz("Asia/Manila");
					var timestamp = atz.toDate();

			        history.push({
			        	timestamp : timestamp,
			        	changes : "Updated disable_auto_follow_up from "+orig_disable_auto_follow_up+" to "+req.body.disable_auto_follow_up,
			        	by : "Admin "+req.body.admin
			        });
			        couch_doc.history = history;
			        couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
			            if (err){
			                console.log(err.error);
			                db.close();
			                var result = {success:false, error : err.error};
							return res.send(result, 200);
			            }
			        });
			  	});

			  	//display output
			  	db.close();
		        var result = {success:true,  msg : "Invoice has been updated" , disable_auto_follow_up : updated_doc.disable_auto_follow_up, history : updated_doc.history};
				return res.send(result, 200);

		  	});

		});
	});
});


router.all("/get-invoice-email-degree-template", function(req, res, next){


  	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();


	var search_key={"_id" : req.query.mongo_id};
	var degree = req.query.degree;

	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/degree.html');

	db.once('open', function(){
		var promises = [];

		Invoice.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
		    	var result = {success:false, msg : err};
				return res.send(result, 200);
			}


			if(doc.sub_total){
				doc.sub_total_string = doc.sub_total.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
			}

			if(doc.gst_amount){
				doc.gst_amount_string = doc.gst_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
			}

			if(doc.total_amount){
				doc.total_amount_string = doc.total_amount.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
			}


			var per_promise = [];
		    function delay(){ return Q.delay(100); }

		  	doc.db = db;
		  	doc.today = today;


			//Get Client Basic Info
		  	var promise_client_basic_info = doc.getClientInfo();

			//Get Client Current Available Balance
		    var promise_running_balance = doc.getCouchdbAvailableBalance();

		    //Get Client Active Subcons
		    var promise_active_subcons = doc.getClientActiveSubcons();

			per_promise.push(promise_client_basic_info);
		    per_promise.push(delay);

		    per_promise.push(promise_running_balance);
		    per_promise.push(delay);

		    per_promise.push(promise_active_subcons);
		    per_promise.push(delay);



		    //Check all settled promises
		    per_promises_promise = Q.allSettled(per_promise);
		    promises.push(per_promises_promise);
		    promises.push(delay);


		    var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){


				var invoice = doc.getInvoice();
				invoice.running_balance_str = invoice.running_balance.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
				var orig_added_on = invoice.added_on;
                invoice.added_on_str = moment(orig_added_on).format("Do [of] MMMM YYYY");




				console.log(invoice.active_subcons);
				var output = template({
					doc : invoice,
					degree : degree
				});

				db.close();
				return res.send(output, 200);
			});

		});
	});
});

/**
 * Updated daily rates entries for splitting of invoice
 * @url http://test.njs.remotestaff.com.au/invoice/sync-daily-rates/
 */
router.all("/sync-daily-rates", function(req, res, next){
	var result;
	/*
	if (typeof req.body.order_id == "undefined" ||req.body.order_id==""){
		result = {success:false};
		return res.send(result, 200);
	}
*/
	var order_id = req.query.order_id;

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	db.once('open', function(){
		//check if order id is already created
		var promise_mongo_find_order_Deferred = Q.defer();
		var promise_mongo_find_order = promise_mongo_find_order_Deferred.promise;

		Invoice.findOne({order_id:order_id}).exec(function(err, invoice){
			if (err){
				promise_mongo_find_order_Deferred.resolve(null);
			}else{
				promise_mongo_find_order_Deferred.resolve(invoice);
			}
		});

		promise_mongo_find_order.then(function(result_invoice){
			if (result_invoice!=null){
				console.log(result_invoice);
				result_invoice.syncDailyRates();

			}
		});

		var result = {success:true};
		return res.send(result, 200);
	});
});


/**
 * Save invoice to database
 *
 * @url http://test.njs.remotestaff.com.au/invoice/save/
 *
 */
router.all("/save", function(req, res, next){
	var result;
	if (typeof req.body.order_id == "undefined" ||req.body.order_id==""){
		result = {success:false};
		return res.send(result, 200);
	}

	var invoice = req.body;
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);
	var Client = db.model("Client", clientSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	db.once('open', function(){

		//check if order id is already created
		var promise_mongo_find_order_Deferred = Q.defer();
		var promise_mongo_find_order = promise_mongo_find_order_Deferred.promise;

		Invoice.findOne({order_id:invoice.order_id}).exec(function(err, invoice){
			if (err){
				promise_mongo_find_order_Deferred.resolve(null);
			}else{
				promise_mongo_find_order_Deferred.resolve(invoice);
			}
		});


		promise_mongo_find_order.then(function(result_invoice){
			if (result_invoice==null){
				//create new invoice
				var promise_mongo_find_order_id_Deferred = Q.defer();
				var promise_mongo_find_order_id = promise_mongo_find_order_id_Deferred.promise;
				var id = parseInt(invoice.client_id);
				search_key={client_id:id};
				Client.findOne(search_key).exec(function(err, client){
					client.db = db;
					client.getNewTaxInvoiceNo().then(function(invoice_no){
						promise_mongo_find_order_id_Deferred.resolve(invoice_no);
					});
				});

				promise_mongo_find_order_id.then(function(invoice_no){
					invoice.order_id = invoice_no;
					invoice.added_on_formatted = atz.format();
					invoice.added_on = atz.toDate();
					if (typeof invoice.pay_before_date != "undefined"){
						invoice.pay_before_date = moment.unix(invoice.pay_before_date_unix).toDate();
					}
					for (var i=0;i<invoice.history.length;i++){
						invoice.history[i].timestamp =  moment.unix(invoice.history[i].timestamp_unix).toDate();
					}
					for (var i=0;i<invoice.items.length;i++){
						invoice.items[i].start_date =  moment(invoice.items[i].start_date).toDate();
						invoice.items[i].end_date =  moment(invoice.items[i].end_date).toDate();
					}
					invoice.type = "order";

					var new_invoice = new Invoice(invoice);
					new_invoice.save(function(err){
						if (err){
							db.close();
							result = {success:false, errors:err};
							return res.send(result, 200);
						}
						new_invoice.updateCouchdbDocument().then(function(body){
							new_invoice.couch_id = body.id;
							new_invoice.save(function(err){
								db.close();
							});
						});
						setTimeout(function(){
							new_invoice.syncDailyRates();
						}, 1000);
						setTimeout(function(){
							new_invoice.syncVersion();
						}, 3000);

						result = {success:true, order_id:new_invoice.order_id};
						return res.send(result, 200);
					});
				});

			}else{
				result_invoice.items = invoice.items;
				result_invoice.history = invoice.history;
				result_invoice.sub_total = invoice.sub_total;
				result_invoice.total_amount = invoice.total_amount;
				result_invoice.gst_amount = invoice.gst_amount;
				if (typeof invoice.pay_before_date != "undefined"){
					result_invoice.pay_before_date = moment.unix(invoice.pay_before_date_unix).toDate();
					result_invoice.pay_before_date_unix = invoice.pay_before_date_unix;
				}
				if (typeof invoice.added_on != "undefined"){
					result_invoice.added_on = moment.unix(invoice.added_on_unix).toDate();
					result_invoice.added_on_unix = invoice.added_on_unix;
				}
				for (var i=0;i<invoice.history.length;i++){
					result_invoice.history[i].timestamp =  moment.unix(invoice.history[i].timestamp_unix).toDate();
				}
				for (var i=0;i<invoice.items.length;i++){
					invoice.items[i].start_date =  moment(invoice.items[i].start_date).toDate();
					invoice.items[i].end_date =  moment(invoice.items[i].end_date).toDate();
				}


				result_invoice.save(function(err){
					if (err){
						db.close();
						result = {success:false, errors:err};
						return res.send(result, 200);
					}

					result_invoice.updateCouchdbDocument().then(function(body){
						result = {success:true, order_id:result_invoice.order_id};
						return res.send(result, 200);
					});
					setTimeout(function(){
						result_invoice.syncDailyRates();
					}, 1000);
					setTimeout(function(){
						result_invoice.syncVersion();
					}, 3000);

				});



			}
		});

	});


});

/**
 * Get Split View of Invoice
 *
 * @url http://test.njs.remotestaff.com.au/invoice/split-view/
 *
 */
router.all("/split-view", function(req, res, next){
	var result;
	if (typeof req.query.order_id == "undefined" ||req.query.order_id==""){
		result = {success:false};
		return res.send(result, 200);
	}
	var invoiceSchema = require("../models/Invoice");
	var subcontractorSchema = require("../models/Subcontractor");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);
	var Subcontractor = db.model("Subcontractor", subcontractorSchema);
	db.once('open', function(){
		Invoice.findOne({order_id:req.query.order_id}).exec((err, invoice)=>{
			var output_items = [];

			function getInvoiceItemSplit(invoice_item){


				function getInvoiceItem(start_date, end_date, invoice_item){
					var promise_deferred = Q.defer();
					var promise = promise_deferred.promise;
					var MongoClient = require('mongodb').MongoClient;
					var ObjectId = require('mongodb').ObjectID;
					MongoClient.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){

						var filter = { $match: {order_id: req.query.order_id, timestamp:{ $gte: parseInt(moment(start_date).format("X")), $lte: parseInt(moment(end_date).format("X")) }, subcontractors_id:{'$in':[""+invoice_item.subcontractors_id, parseInt(invoice_item.subcontractors_id)]}}};
						var collection_name = "order_item_values";
						if (invoice_item.item_type=="Currency Adjustment"){
							collection_name = "currency_adjustment_values";
						}
						db.collection(collection_name).aggregate(
							[
							filter,
							{ $group: { "_id": "$key", "sum": { $sum: "$value" }, "count":{$sum:1} } }
							]).toArray(function(err, result) {
							if (collection_name=="order_item_values"){
								Subcontractor.findOne({subcontractors_id:parseInt(invoice_item.subcontractors_id)}).exec((err, subcon)=>{
									if (typeof subcon == "undefined"){
										promise_deferred.resolve(result);
										return;
									}
									var basic = subcon.getBasic();
									for(var k=0;k<result.length;k++){
										result[k].start_date = start_date;
										result[k].end_date = end_date;
										result[k].description = invoice_item.description;
										if (basic.work_status=="Full-Time"){
											result[k].qty = result[k].count * 8;
										}else{
											result[k].qty = result[k].count * 4;
										}
										result[k].unit_price = basic.hourly_rate;
										result[k].item_type = invoice_item.item_type;
										result[k].item_id = k+1;
										result[k].amount = result[k].unit_price * result[k].qty;
									}
									promise_deferred.resolve(result);
								});
							}else{
								Subcontractor.findOne({subcontractors_id:parseInt(invoice_item.subcontractors_id)}).exec((err, subcon)=>{
									if (typeof subcon == "undefined"){
										promise_deferred.resolve(result);
										return;
									}
									var basic = subcon.getBasic();
									for(var k=0;k<result.length;k++){
										result[k].start_date = start_date;
										result[k].end_date = end_date;
										result[k].description = invoice_item.description;
										if (basic.work_status=="Full-Time"){
											result[k].qty = result[k].count * 8;
										}else{
											result[k].qty = result[k].count * 4;
										}
										result[k].unit_price = result[k].sum/result[k].count;
										result[k].item_type = invoice_item.item_type;
										result[k].item_id = k+1;
										result[k].amount = result[k].unit_price * result[k].qty;
									}
									promise_deferred.resolve(result);
								});
							}




						});
					});
					return promise;
				}

				var promise_deferred = Q.defer();
				var promise = promise_deferred.promise;
				console.log(invoice_item.item_type);
				if (invoice_item.item_type == "Regular Rostered Hours" || invoice_item.item_type == "Currency Adjustment"){
					if (typeof invoice_item.start_date != "undefined" && typeof invoice_item.end_date != "undefined"){
						//if not the same month

						var tz_start_date_gmt = moment_tz(invoice_item.start_date).tz("GMT");
						var atz_start_date = tz_start_date_gmt.clone().tz("Asia/Manila");

						var tz_end_date_gmt = moment_tz(invoice_item.end_date).tz("GMT");
						var atz_end_date = tz_end_date_gmt.clone().tz("Asia/Manila");


						if (atz_start_date.month()!=atz_end_date.month() || atz_start_date.year()!=atz_end_date.year()){
							console.log("Different cover dates");

							var start = atz_start_date.toDate();
							var end = moment_tz(start).endOf("month").toDate();
							var promise_1 = getInvoiceItem(start, end, invoice_item);
							start = moment_tz(atz_end_date.toDate()).startOf("month").toDate();
							end = atz_end_date;
							var promise_2 = getInvoiceItem(start, end, invoice_item);
							Q.allSettled([promise_1, promise_2]).then((result_pair) => {
								for (var k=0;k<result_pair.length;k++){
									var pairs = result_pair[k].value;
									for(var l=0;l<pairs.length;l++){
										output_items.push(pairs[l]);
									}
								}
								promise_deferred.resolve(result_pair);
							});

						}else{
							getInvoiceItem(atz_start_date.toDate(), atz_end_date.toDate(), invoice_item).then((result)=>{
								var pairs = result;
								//console.log(result);
								for(var l=0;l<pairs.length;l++){
									output_items.push(pairs[l]);
								}
								promise_deferred.resolve(pairs);
							});

						}
					}else{
						setTimeout(function(){
							output_items.push(invoice_item);
							promise_deferred.resolve(invoice_item);
						}, 100);
					}
				}else{
					setTimeout(function(){
						output_items.push(invoice_item);
						promise_deferred.resolve(invoice_item);
					}, 100);
				}
				return promise;
			}
			var promises = [];
			for(var i=0;i<invoice.items.length;i++){
				var pm = getInvoiceItemSplit(invoice.items[i]);
				promises.push(pm);
			}

			Q.allSettled(promises).then(function(result){

				function getInvoiceDetails(order_id){
					var promise_Deferred = Q.defer();
					var promise = promise_Deferred.promise;

					http.get("http://127.0.0.1:3000"+"/invoice/get-invoice-details/?order_id="+order_id, (res) => {
						res.setEncoding('utf-8')

						var body = '';

						res.on('data', function(chunk){
							body += chunk;
						});

						res.on("end", function(){
							data = JSON.parse(body);
							promise_Deferred.resolve(data);
						});
					})
					return promise;
				}

				for(var i=0;i<output_items.length;i++){
					output_items[i].item_id = i+1;
				}
				getInvoiceDetails(invoice.order_id).then((result)=>{
					result.result.items = output_items;


					return res.status(200).send({success:true, result:result.result, client_basic_info : result.client_basic_info});
				});
			});
		});
	});
});


/**
 * To save the invoice delivered to client
 */
router.all("/save-delivered-email-invoice",function(req,res,next){

	console.log(req.body.order_id);
	console.log(req.body.doc_id);


	if(!req.body.order_id){
		return res.status(200).send({success:false, error:"order_id is required!"});
	}

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);

	var EmailInvoice = db.model("EmailInvoice", emailInvoiceSchema);


	db.once('open', function(){

		EmailInvoice.findOne({accounts_order_id: req.body.order_id}).exec(function (err, foundReport) {

			var new_delivered_invoice = foundReport;


			if(foundReport){
				console.log("existing report found!");

				new_delivered_invoice.isNew = false;

			} else{

				new_delivered_invoice = new EmailInvoice();
			}

            new_delivered_invoice.db = db;



			new_delivered_invoice.saveInvoiceEmailDelivered(req.body.order_id, req.body.doc_id).then(function(result){

				db.close();

				return res.status(200).send({success:true, order_id:req.body.order_id, couch_id: req.body.doc_id});
			});

		});

	});



});


router.post("/get-invoice-email-report",function(req,res,next){
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);
	var InvoiceReporting = db.model("InvoiceEmailReporting", emailInvoiceSchema);
	var search_key = {};

	var q_query = [];

	var and_query = [];


	if(req.body.filter)
	{
		and_query.push({"email_status" : req.body.filter});
	}

	if(req.body.daterange){
		search_key = {
			date_delivered : {
				$gte: new Date(moment_tz(req.body.daterange.startDate).format("YYYY-MM-DD HH:mm:ss")),
				$lte: new Date(moment_tz(req.body.daterange.endDate).format("YYYY-MM-DD HH:mm:ss")),
			}
		}
		// and_query.push(date_delivered_query);
	}
	if(req.body.q){
		q_query = [
			{"client_full_name": {'$regex' : req.body.q, '$options' : 'i'}},
			{"client_id": {'$regex' : req.body.q, '$options' : 'i'}},
			{"client_fname": {'$regex' : req.body.q, '$options' : 'i'}},
			{"client_lname": {'$regex' : req.body.q, '$options' : 'i'}},
			{"email": {'$regex' : req.body.q, '$options' : 'i'}},
			{"accounts_order_id": {'$regex' : req.body.q, '$options' : 'i'}},
		];

		and_query.push({$or:q_query});
	}

	console.log(search_key);
	console.log(q_query);


	db.once('open', function(){

		var clients=[];
		var promises = [];

		var current_query = InvoiceReporting.find(search_key);

		if(req.body.q || req.body.filter){
			current_query.and(and_query);
		}


        function delay(){ return Q.delay(100); }
		current_query.sort({"invoice_date_created":"desc"}).exec(function(err,report_data){

			if(!err)
			{
				function fetchReport(i){
					item = report_data[i];
					item.db = db;

					promises.push(item.getreportFields());
					promises.push(delay);
				}

				for(var i=0;i<report_data.length;i++){
					fetchReport(i);
				}

				var allPromise = Q.allSettled(promises);
				allPromise.then(function(results){
					console.log("ALL fetching of REPORTS DONE!");

					for(var i=0;i<report_data.length;i++){
						var current_report_data = report_data[i].getInvoiceCreationView();


						if(typeof current_report_data.client_settings_email != "undefined" && typeof current_report_data.client_docs[0].client_email != "undefined"){
							if(current_report_data.client_settings_email.toLowerCase() == current_report_data.client_docs[0].client_email.toLowerCase()){
								clients.push(current_report_data);
							}
						}
					}


					var result = {success:true, data_report : clients, total_report_data : report_data.length};
					db.close();
					return res.status(200).send(result);
				});
			}
			else
			{
				var result = {success:false, msg : err};
				return res.status(200).send(result);
			}


		});

	});


});


router.post("/add-invoice-notes",function(req,res,next){



	var _id = req.body.mongo_id;
	var admin_name = req.body.admin_name;
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var search_key={"_id" : _id};


	var nano = configs.getCouchDb();
	var db_name = "client_docs";
	var couch_db = nano.use(db_name);


	//update mongodb
	db.once('open', function(){

		Invoice.findOne(search_key, function(err, doc){
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

			if (typeof doc.comments != "undefined"){
				var comments = doc.comments;
			}else{
				var comments = new Array();
			}

			comments.push({
				date : timestamp,
				comment : req.body.comments,
				name : admin_name
			});
			doc.comments = comments;


			if (typeof doc.history != "undefined"){
				var history = doc.history;
			}else{
				var history = new Array();
			}

			history.push({

				"timestamp": timestamp,
				"changes": "Added note: " + req.body.comments,
				"by": admin_name
			});
			doc.comments = comments;
            doc.history = history;


			console.log(doc.comments);
			//Update mongodb
			doc.save(function(err, updated_doc) {

				if (err) {
					console.log(err);
					db.close();
					var result = {success: false, error: err ,msg:""};
					return res.status(200).send(result);
				}
				else
				{

					//Update Couchdb
					couch_db.get(req.body.couch_id, function(err, couch_doc) {
						updaterev = couch_doc._rev;
						couch_doc._rev = updaterev;


						//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
						var today = moment_tz().tz("GMT");
						var atz = today.clone().tz("Asia/Manila");
						var timestamp = atz.toDate();

						couch_doc.mongo_synced = false;
						if (typeof couch_doc.comments != "undefined"){
							var comments = couch_doc.comments;
						}else{
							var comments = [];
						}

						comments.push({
							date : timestamp,
							comment : req.body.comments,
							name : admin_name
						});
						couch_doc.comments = comments;

						couch_db.insert( couch_doc, req.body.couch_id, function(err, body , header) {
							if (err){
								console.log(err.error);
								db.close();
								var result = {success:false, error : err.error};
								return res.send(result, 200);
							}
							else
							{
								// console.log(couch_doc);
							}
						});
					});

					db.close();
					var result = {success:true,  msg : "Invoice note has been added" , comments : updated_doc.comments};
					return res.status(200).send(result);
				}

			});

		});


	});


});


/**
 * Method to fetch the status of a invoice
 * @url /invoice/fetch-status?order_id=12334-00000019
 *
 * @param order_id The order_id of the invoice
 */
router.get("/fetch-status",function(req,res,next){
	if(!req.query.order_id){
		return res.status(200).send({success: false, error: ["order_id is required"]});
	}

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var invoiceSchema = require("../models/Invoice");

	var InvoiceModel = db.model("Invoice", invoiceSchema);

	db.once("open", function(){
		InvoiceModel.findOne({order_id:req.query.order_id}).lean().select({
			order_id: true,
			status: true
		}).exec(function(err, doc){
			if(err){
				return res.status(200).send({success: false, error: [err]});
			}
			if(doc){
				return res.status(200).send({success: true, result: doc});
			} else{
				return res.status(200).send({success: false, error: ["Invoice does not exist"]});
			}


		});
	});



});

module.exports = router;
