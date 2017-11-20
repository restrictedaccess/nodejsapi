var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Queue = require('bull');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

//var invoicePaymentsSchema = require("../models/InvoicePayments");

var insert_invoice_payments_queue = Queue("insert_invoice_payments_queue", 6379, '127.0.0.1');
var send_invoice_payment_receipt_queue = require("../bull/send_invoice_payment_receipt");

insert_invoice_payments_queue.process(function(job, done){
	console.log("Starting bull insert_invoice_payments_queue process...");
	console.log(job.data.couch_id);
	
	var couch_id = job.data.couch_id;

	//var admin_id = null;
	//var set_paid_by = "system";
	// if(typeof job.data.admin_id != "undefined"){
	// 	var admin_id = 	job.data.admin_id;
	// 	var set_paid_by = "admin";
	// }
	

	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);
  	
  	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
		
	console.log("couch_id : " + couch_id);

	var remarks = "";
	var over_payment = false;

	function getCouchClientSettings(client_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		
		//Get Client Settings
		var queryOptions = {startkey : [parseInt(client_id), [moment(today).year(), (moment(today).month()+1), moment(today).date(), 0, 0, 0]], endkey : [parseInt(client_id), [2011, 0, 0, 0, 0, 0]], descending : true, limit : 1};
		couch_db.view('client','settings', queryOptions, function(err, response) {
	    	if (err) throw err;
	    	deferred_promise.resolve(response);
	  	});
		return promise;
	}
	
	function getInvoiceDoc(couch_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		
		couch_db.get(couch_id, function(err, body){		
			if (err){
				console.log(err);
				throw err;				
			}
			delete body._rev;
  			deferred_promise.resolve(body);
 	 	});
		return promise;
	}

	function getCouchDoc(couch_id){
		var deferred_promise = Q.defer();
		var promise = deferred_promise.promise;
		
		couch_db.get(couch_id, function(err, body){			
			delete body._rev;			
  			deferred_promise.resolve(body);
 	 	});
		return promise;
	}

	getInvoiceDoc(couch_id).then(function(doc){
		console.log("Retrieved document.");
		console.log(doc._id);	
		var client_id = doc.client_id;
		getCouchClientSettings(client_id).then(function(response){
			if(typeof response.rows != "undefined"){
				console.log("Retrieved client setting.");
				var client_setting_doc = response.rows[0];
				var client_setting_couch_id = client_setting_doc.id;
				console.log(client_setting_couch_id);
				getCouchDoc(client_setting_couch_id).then(function(client_setting){
					console.log("Retrieved client days_before_suspension : "+ client_setting.days_before_suspension);
					//console.log(typeof client_setting.days_before_suspension);

					var billing_type = "monthly invoice";
					if(client_setting.days_before_suspension != -30){
						var billing_type = "prepaid invoice";
					}

					var payment_mode = "Bank Transfer";
					if (typeof doc.payment_mode != "undefined"){
						var payment_mode = doc.payment_mode;
					}

					
					if (typeof doc.over_payment != "undefined"){
						var over_payment = doc.over_payment;
					}

					if (typeof doc.remarks != "undefined"){
						remarks += doc.remarks;
					}

					// if (typeof doc.particular != "undefined"){
						// remarks += " "+doc.particular;
					// }

					if(over_payment){
						remarks += " Generated over payment invoice.";
					}
					//console.log("billing_type : " + billing_type);
					var pay_before_date = null;
					if(typeof doc.pay_before_date != "undefined"){
						var timestamp = doc.pay_before_date
						timestamp = timestamp[0]+"-"+timestamp[1]+"-"+timestamp[2]+" "+timestamp[3]+":"+timestamp[4]+":"+timestamp[5];				
						//pay_before_date = moment(timestamp, "YYYY-MM-DD HH:mm:ss").toDate();
						pay_before_date = moment.utc(timestamp, "YYYY-MM-DD HH:mm:ss").toDate();
					}

					var invoice_date = null;
					if(typeof doc.added_on != "undefined"){
						var timestamp = doc.added_on
						timestamp = timestamp[0]+"-"+timestamp[1]+"-"+timestamp[2]+" "+timestamp[3]+":"+timestamp[4]+":"+timestamp[5];				
						//invoice_date = moment(timestamp).toDate();
						invoice_date = moment.utc(timestamp, "YYYY-MM-DD HH:mm:ss").toDate();
					}

					var admin_id = null;
					if(typeof doc.admin_id != "undefined"){
						admin_id = 	doc.admin_id;						
					}

					var set_paid_by = null;
					if(typeof doc.set_paid_by != "undefined"){
						set_paid_by = 	doc.set_paid_by;						
					}

					var admin_name = null;
					if(typeof doc.admin_name != "undefined"){
						admin_name = 	doc.admin_name;						
					}

					var couch_id = doc._id;
					var mongo_doc = {
						couch_id : couch_id,
						added_on : today,
						transaction_id : null,
						transaction_doc : null,        
						client_id : doc.client_id,
						payment_mode : payment_mode,
						order_id : doc.order_id,
						invoice_date : invoice_date,
						pay_before_date : pay_before_date,
						input_amount :  doc.input_amount,
						total_amount :  doc.total_amount,
						currency :  doc.currency,
						payment_date : doc.date_paid,
						days_before_suspension : client_setting.days_before_suspension,
						billing_type : billing_type,
						remarks : remarks,         
						set_paid_by: set_paid_by,        
						admin_id : parseInt(admin_id),
						admin_name : admin_name,
						response  : null,
						doc_order : doc,
						over_payment : over_payment,
						receipt_number : "OR-"+doc.order_id
					};

					var MongoClient = require('mongodb').MongoClient;
					MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
						var collection = db.collection("invoice_payments");
						var filter = {couch_id : couch_id};						
						collection.findOneAndUpdate(filter, mongo_doc, {upsert:true}, function(err, doc){

							if (err) {
								db.close(); 
								console.log(err);
							}
							db.close();
							console.log("added succesfully  : " + couch_id);
							send_invoice_payment_receipt_queue.add({couch_id : couch_id}); 
							done(null, {success:true});

						});	
					});
					
				});
				
			}
						
		});
		 						
	});

});

module.exports = insert_invoice_payments_queue;