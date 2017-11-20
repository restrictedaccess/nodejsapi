var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var moment = require('moment');
var moment_tz = require('moment-timezone');

var Q = require('q');
var swig  = require('swig');
var fs = require('fs');
var pdf = require('html-pdf');

//handling file
var multer  = require('multer');
var upload = multer({ dest: '../uploads/'});
var type = upload.any();

//import ClientsSchema
var clientSchema = require("../models/Client");
var invoiceSchema = require("../models/Invoice");
var quoteComponent = require("../components/Quote");
var emailInvoiceSchema = require("../models/EmailInvoice");

var invoiceCreationTrack = require("../models/InvoiceCreationTrack");

var mongoCredentials = configs.getMongoCredentials();

var send_invoice_payment_receipt_queue = require("../bull/send_invoice_payment_receipt");
var insert_invoice_payments_queue = require("../bull/insert_invoice_payments");

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

//http://test.njs.remotestaff.com.au/send/send-payment-receipt/?couch_id=6f2c32db2eba49a6577c573aaeaedfd1
router.all("/send-payment-receipt", function(req, res, next){

	var today = false;
	var couch_id = req.query.couch_id;

	if(typeof couch_id != "undefined" && couch_id !=""){
		setTimeout(function(){
			send_invoice_payment_receipt_queue.add({couch_id : couch_id});
			return res.status(200).send({success:true});
		}, 10000);
	}else{
		return res.status(200).send({success:false, err: "No couch_id detected"});
	}
});

//http://test.njs.remotestaff.com.au/send/manual-send-payment-receipt/?couch_id=6f2c32db2eba49a6577c573aaeaedfd1
router.all("/manual-send-payment-receipt", function(req, res, next){

	var today = false;
	var couch_id = req.query.couch_id;

	if(typeof couch_id != "undefined" && couch_id !=""){
		setTimeout(function(){
			insert_invoice_payments_queue.add({couch_id : couch_id});
			return res.status(200).send({success:true});
		}, 10000);
	}else{
		return res.status(200).send({success:false, err: "No couch_id detected"});
	}
});

//http://test.njs.remotestaff.com.au/send/attach-pdf-invoice/?mongo_id=584f58536d1c6f6d078b4567&mailbox_doc_id=0a9234fdf8218ef72ea70a540afcab99
router.all("/attach-pdf-invoice", function(req,res,next){
	var mongo_id = req.query.mongo_id;
	var mailbox_doc_id = req.query.mailbox_doc_id;

	console.log("mongo_id " + mongo_id);
	console.log("mailbox_doc_id " + mailbox_doc_id);


	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();

	var search_key={"_id" : mongo_id};

	//var result = {success:true};
	//return res.send(result, 200);

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

			if(doc.pay_before_date){
				doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("Do [of] MMMM YYYY");
			}
			
			
			var db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);
			var InvoiceReporting = db_invoice.model("InvoiceEmailReporting", emailInvoiceSchema);
			
			var search_key_date = {
				accounts_order_id: doc.order_id

			};
            db_invoice.once('open', function () {
				try{
					InvoiceReporting.findOne(search_key_date).exec(function(err, data){
						date_delivered = data;
						if(date_delivered){
                            doc.date_delivered_string = moment(date_delivered.date_delivered).format("MMMM DD, YYYY");
						}
                        invoice_reporting_defer.resolve(doc);
                        db_invoice.close();
					});
				}catch(e)
				{
					console.log(e);
				}

			});
			
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

				//Create HTML File
				doc.createHTMLInvoice().then(function(html_file){
					console.log("html_file" + html_file);

					//Convert HTML file to PDF file.
					doc.convertHTML2PDF(html_file).then(function(pdf_file){

						//Attach PDF
						doc.attachPDF(mailbox_doc_id, pdf_file).then(function(pdf_filename){

							fs.unlink(html_file, function(err) {
								if (err) {
									return console.error(err);
								}
								console.log("Deleted "+html_file);
							});

							fs.unlink(pdf_file, function(err) {
								if (err) {
									return console.error(err);
								}
								console.log("Deleted "+pdf_file);
							});

							db.close();
							var result = {success:true};
							return res.send(result, 200);
						});
					});
				});
			});
		});
	});
});

/*
 * For testing and debugging purposes only
 * @url http://test.njs.remotestaff.com.au/send/test/?mongo_id=57445529531007b54a8b4567
 * */
router.all("/test", function(req,res,next){
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();


	var search_key={"_id" : req.query.mongo_id};
	//console.log(search_key);
	db.once('open', function(){
		var promises = [];

		Invoice.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
				var result = {success:false, msg : err};
				return res.send(result, 200);
			}
			doc.getClientInvoiceEmailSettings().then(function(recipients){
				//console.log(recipients);

				//Send email via mailbox
				for(var i=0; i<recipients.length; i++){
					console.log("Sending email to " + recipients[i]);
					var to=[];
					to.push(recipients[i]);
					var mailbox_doc = {
						bcc : ["devs@remotestaff.com.au"],
						cc : null,
						created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
						from : "Accounts<accounts@remotestaff.com.au>",
						sender : null,
						reply_to : null,
						generated_by : "NODEJS/send/invoice/",
						html : "<p>Hello World</p>",
						text : null,
						to : to,
						subject : recipients[i]+" Remotestaff Tax Invoice "+doc.order_id,
						is_invoice: true,
						order_id: doc.order_id,
						sent:false
					};

					//console.log(mailbox_doc);

					doc.sendMailbox(mailbox_doc).then(function(couch_id){
						console.log(couch_id);
					});
				}


				db.close();
				var result = {success:true, result : recipients};
				return res.send(result, 200);
			});

		});

	});
});
//

/*
 * Removed pdf file
 * @url http://test.njs.remotestaff.com.au/send/delete-file/?mongo_id=57445529531007b54a8b4567
 * */
router.all("/delete-file", function(req,res,next){
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var search_key={"_id" : req.query.mongo_id};
	//console.log(search_key);

	db.once('open', function(){
		var promises = [];

		Invoice.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
				var result = {success:false, msg : err};
				return res.send(result, 200);
			}

			function fileExists(path) {
				try  {
					return fs.statSync(path).isFile();
				}
				catch (e) {
					if (e.code == 'ENOENT') { // no such file or directory. File really does not exist
						console.log("File does not exist.");
						return false;
					}
					console.log("Exception fs.statSync (" + path + "): " + e);
					//throw e; // something else went wrong, we don't have rights, ...
					return false;
				}
			}

			var path = '/home/remotestaff/tmp/';
			var order_id = doc.order_id;

			//pdf file
			var pdf_filename = "invoice-"+order_id+".pdf";
			var pdf_file = path+""+pdf_filename;
			var msg="";
			if(fileExists(pdf_file)){
				fs.unlinkSync(pdf_file, function(err) {
					if (err) {
						return console.error(err);
					}
					console.log("Deleted "+pdf_file);
				});
			}else{
				console.log("File does not exist : "+pdf_file);
			}



			db.close();
			var result = {success:true};
			return res.send(result, 200);
		});
	});


});

/*
 * Send invoice via email wth attachment per recipient depending on the client email invoice settings
 * @url http://test.njs.remotestaff.com.au/send/invoice-with-attachment-per-recipient/?mongo_id=57445529531007b54a8b4567
 * */
router.post("/invoice-with-attachment-per-recipient", function(req,res,next){
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);
	var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();


	var search_key={"_id" : req.body.mongo_id};
	console.log(search_key);
	console.log("invoice-with-attachment-per-recipient params");
	console.log(req.body);

	var custom_message = "";
	var custom = req.body.custom;

	if(custom == true){
		var custom_message = req.body.custom_message;
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-with-custom-message.html');
	}else{
		var custom_message = "";
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice.html');
	}


	db.once('open', function(){
		var promises = [];
		var date_delivered = null;
		Invoice.findOne(search_key).exec(function(err, doc){

			if(err){
				db.close();
				var result = {success:false, msg : err};
				return res.send(result, 200);
			}

            var per_promise = [];

			var all_required_for_pdf_promises = [];

			var invoice_reporting_defer = Q.defer();
			var invoice_reporting_promise = invoice_reporting_defer.promise;

			var promise_running_balance_defer = Q.defer();
			var running_balance_promise_before = promise_running_balance_defer.promise;

            all_required_for_pdf_promises.push(invoice_reporting_promise);
            all_required_for_pdf_promises.push(running_balance_promise_before);


			var db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);
			var InvoiceReporting = db_invoice.model("InvoiceEmailReporting", emailInvoiceSchema);
			
			var search_key_date = {
				accounts_order_id: doc.order_id

			};
            db_invoice.once('open', function () {
				try{
					InvoiceReporting.findOne(search_key_date).exec(function(err, data){
						date_delivered = data;
						if(date_delivered){
                            doc.date_delivered_string = moment(date_delivered.date_delivered).format("MMMM DD, YYYY");
						}
                        invoice_reporting_defer.resolve(doc);
                        db_invoice.close();
					});
				}catch(e)
				{
					console.log(e);
				}

			});

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
			if(doc.pay_before_date){

				doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("MMMM DD, YYYY");
			}
			if(doc.added_on){
				doc.added_on_ordinal_string = moment(doc.added_on).format("MMMM DD, YYYY");
			}


			function delay(){ return Q.delay(100); }

			function fileExists(path) {

				try  {
					return fs.statSync(path).isFile();

				}
				catch (e) {

					if (e.code == 'ENOENT') { // no such file or directory. File really does not exist
						console.log("File does not exist.");
						return false;
					}

					console.log("Exception fs.statSync (" + path + "): " + e);
					//throw e; // something else went wrong, we don't have rights, ...
					return false;

				}
			}

			doc.db = db;

			var promise_client_basic_info = null;
			var promise_create_html_2_pdf = null;
			var promise_running_balance = null;
			var promise_client_invoice_email_settings = null;



			//Get Client Basic Info
			doc.getClientInfo().then(function(result){

				if(result)
				{

					promise_client_basic_info = result;


					//Get Client Current Available Balance
					promise_running_balance = doc.getCouchdbAvailableBalance();

                    promise_running_balance.then(function(fetchingResult){
                        promise_running_balance_defer.resolve(fetchingResult);
					});

					//Get Client email invoice settings
					promise_client_invoice_email_settings = doc.getClientInvoiceEmailSettings();

					//Create HTML File
					promise_create_html_2_pdf_defered = Q.defer();

                    promise_create_html_2_pdf = promise_create_html_2_pdf_defered.promise;

					//promise_create_html_2_pdf = doc.createHTML2PDF();


                    Q.allSettled(all_required_for_pdf_promises).then(function(fetchedRunningBalance){
                        doc.createHTML2PDF().then(function(created_pdf){
                            promise_create_html_2_pdf_defered.resolve(created_pdf);
						})
					});

					per_promise.push(promise_client_basic_info);
					per_promise.push(delay);

					per_promise.push(promise_running_balance);
					per_promise.push(delay);

					per_promise.push(promise_client_invoice_email_settings);
					per_promise.push(delay);


					per_promise.push(promise_create_html_2_pdf);
					per_promise.push(delay);


					//Check all settled promises
					per_promises_promise = Q.allSettled(per_promise);
					promises.push(per_promises_promise);
					promises.push(delay);

					var allPromise = Q.allSettled(promises);
					allPromise.then(function(results){

						invoice = doc.getInvoice();

						var html_file = invoice.html_file;
						var pdf_file = invoice.pdf_file;
						console.log(pdf_file);

						var recipients=[];
						var output = template({
							doc : invoice,
							custom_message : custom_message
						});


						if(custom == true){
							var multiple_emails = req.body.multiple_emails;
							for(var i=0; i<multiple_emails.length; i++){

								var myString = multiple_emails[i];
								var myWord = "remotestaff.com";
								var myPattern = new RegExp('(\\w*'+myWord+'\\w*)','gi');

								var matches = myString.match(myPattern);
								var client_recipient = false;
								if (matches === null){
									client_recipient = true;
								}
								console.log(multiple_emails[i] +" "+client_recipient);
								recipients.push({
									email : multiple_emails[i],
									client_recipient : client_recipient
								});
							}

						}else{
							if(invoice.invoice_recipients == null || invoice.invoice_recipients == undefined){
								//recipients.push(doc.client_email);
								recipients.push({
									email : doc.client_email,
									client_recipient : true
								});
							}else{
								recipients = invoice.invoice_recipients;
							}
						}

						var history = invoice.history;
						var today = moment_tz().tz("GMT");
						var atz = today.clone().tz("Asia/Manila");
						var timestamp = atz.toDate();
						var recipients_email=[];
						for(var i=0; i<recipients.length; i++){
							console.log("Sending invoice to : " + recipients[i].email);

							if(recipients[i].email !="" && recipients[i].email != null){

								to=[];
								to.push(recipients[i].email);

								recipients_email.push(recipients[i].email);

								//Send email via mailbox
								var mailbox_doc = {
									bcc : null,
									cc : null,
									created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
									from : "Accounts<accounts@remotestaff.com.au>",
									sender : null,
									reply_to : null,
									generated_by : "NODEJS/send/invoice/",
									html : output,
									text : null,
									to : to,
									//sent : false,
									subject : "Remotestaff Tax Invoice "+doc.order_id,
									is_invoice: recipients[i].client_recipient,
									order_id: doc.order_id
								};


								//Insert document in couchdb mailbox
								doc.sendMailbox(mailbox_doc).then(function(couch_id){
									//Attach PDF
									doc.attachPDF(couch_id, pdf_file).then(function(pdf_filename){
										//Update mailbox document
										doc.updateMailboxDoc(couch_id).then(function(result){
											//do nothing

										});
									});
								});

							}
						}//End loop


						var filter = {order_id: doc.order_id};
						console.log('pasok');
						console.log(filter);
						try{
							InvoiceCreation.findOneAndUpdate(filter, {queue:"sent"}, {upsert: true}, function (err, doc) {
								if (err) {
									console.log(err);
								}
								console.log("Success updating track");
							});
						}catch(e)
						{
							console.log(e);
						}

						var changes = "Email sent to  " + recipients_email.join();
						console.log(changes);

						if(fileExists(html_file)){
							console.log("File still exist "+html_file);
							fs.unlink(html_file, function(err) {
								if (err) {
									return console.error(err);
								}
								console.log("Deleted "+html_file);
							});
						}

						/*
						 if(fileExists(pdf_file)){
						 fs.unlinkSync(pdf_file, function(err) {
						 if (err) {
						 return console.error(err);
						 }
						 console.log("Deleted "+pdf_file);
						 });
						 }
						 */


						history.push({
							timestamp : timestamp,
							changes : changes,
							by : "Admin "+req.body.admin
						});
						doc.history = history;
						doc.sent_last_date = timestamp;
						//console.log(doc.history);


						//Update mongodb
						doc.save(function(err, updated_doc){
							if (err){
								console.log(err);
								db.close();
								var result = {success:false, error : err};
								return res.send(result, 200);
							}

							//Update Couchdb
							couch_db.get(doc.couch_id, function(err, couch_doc) {
								updaterev = couch_doc._rev;
								couch_doc._rev = updaterev;


								//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
								var today = moment_tz().tz("GMT");
								var atz = today.clone().tz("Asia/Manila");
								var timestamp = atz.toDate();

								//couch_doc.date_cancelled = timestamp;
								couch_doc.sent_last_date = timestamp;
								couch_doc.mongo_synced = true;
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

							db.close();
							var result = {
								success:true,
								msg : changes,
								history : updated_doc.history
							};
							return res.send(result, 200);
						});

						/*
						 db.close();
						 var result = {
						 success:true,
						 msg : "Invoice has been sent to client "+ doc.client_fname + " "+ doc.client_lname + " "+ doc.client_email,
						 };
						 return res.send(result, 200);
						 */
					});
				}
				else
				{
					return res.status(200).send({success:false,msg:"No client info"});
				}

			});

		});

	});

});

/*
 * Send invoice via email wth attachment 
 * @url http://test.njs.remotestaff.com.au/send/invoice-with-attachment/ 
 * */
router.post("/invoice-with-attachment", function(req,res,next){
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();


	var search_key={"_id" : req.body.mongo_id};
	console.log(search_key);

	var custom_message = "";
	var custom = req.body.custom;

	if(custom == true){
		var custom_message = req.body.custom_message;
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-with-custom-message.html');
	}else{
		var custom_message = "";
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice.html');
	}

	db.once('open', function(){
		var promises = [];

		Invoice.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
				var result = {success:false, msg : err};
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

			if(doc.pay_before_date){
				doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("Do [of] MMMM YYYY");
			}

			var per_promise = [];
			function delay(){ return Q.delay(100); }

			doc.db = db;


			//Get Client Basic Info
			var promise_client_basic_info = doc.getClientInfo();

			//Get Client Current Available Balance
			var promise_running_balance = doc.getCouchdbAvailableBalance();

			//Get Client email invoice settings
			//var promise_client_invoice_email_settings = doc.getClientInvoiceEmailSettings();

			per_promise.push(promise_client_basic_info);
			per_promise.push(delay);

			per_promise.push(promise_running_balance);
			per_promise.push(delay);

			//per_promise.push(promise_client_invoice_email_settings);
			//per_promise.push(delay);

			//Check all settled promises
			per_promises_promise = Q.allSettled(per_promise);
			promises.push(per_promises_promise);
			promises.push(delay);

			var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){

				//var result = {success:true, doc : doc};
				//return res.send(result, 200);

				//Create HTML File
				doc.createHTMLInvoice().then(function(html_file){

					//Convert HTML file to PDF file.
					doc.convertHTML2PDF(html_file).then(function(pdf_file){

						invoice = doc.getInvoice();
						console.log(invoice.currency);
						var output = template({
							doc : invoice,
							custom_message : custom_message
						});

						console.log("custom => " + custom);
						if(custom == true){
							to = req.body.multiple_emails;
							changes = "Custom Message Email sent to  " + to + " " + custom_message;
						}else{
							to=[];
							to.push(doc.client_email);
							changes = "Email sent to  " + to;
						}
						console.log(to);

						//Send email via mailbox
						var mailbox_doc = {
							bcc : ["devs@remotestaff.com.au"],
							cc : null,
							created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
							from : "Accounts<accounts@remotestaff.com.au>",
							sender : null,
							reply_to : null,
							generated_by : "NODEJS/send/invoice/",
							html : output,
							text : null,
							to : to,
							//sent : false,
							subject : "Remotestaff Tax Invoice "+doc.order_id,
							is_invoice: true,
							order_id: doc.order_id
						};

						//Insert document in couchdb mailbox
						doc.sendMailbox(mailbox_doc).then(function(couch_id){

							//Attach PDF
							doc.attachPDF(couch_id, pdf_file).then(function(pdf_filename){

								//Update mailbox document
								doc.updateMailboxDoc(couch_id).then(function(result){

									//console.log(html_file);
									//console.log(pdf_file);
									//console.log(mailbox_doc);
									//console.log(pdf_filename);
									//console.log(result);

									fs.unlink(html_file, function(err) {
										if (err) {
											return console.error(err);
										}
										console.log("Deleted "+html_file);
									});

									fs.unlink(pdf_file, function(err) {
										if (err) {
											return console.error(err);
										}
										console.log("Deleted "+pdf_file);
									});

									//var result = {success:true};
									//return res.send(result, 200);

									//TO DO :
									// - Add history
									var history = doc.history;
									var today = moment_tz().tz("GMT");
									var atz = today.clone().tz("Asia/Manila");
									var timestamp = atz.toDate();

									history.push({
										timestamp : timestamp,
										changes : changes,
										by : "Admin "+req.body.admin
									});
									doc.history = history;
									doc.sent_last_date = timestamp;
									//console.log(doc.history);

									//Update mongodb
									doc.save(function(err, updated_doc){
										if (err){
											console.log(err);
											db.close();
											var result = {success:false, error : err};
											return res.send(result, 200);
										}

										//Update Couchdb
										couch_db.get(doc.couch_id, function(err, couch_doc) {
											updaterev = couch_doc._rev;
											couch_doc._rev = updaterev;


											//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
											var today = moment_tz().tz("GMT");
											var atz = today.clone().tz("Asia/Manila");
											var timestamp = atz.toDate();

											//couch_doc.date_cancelled = timestamp;
											couch_doc.sent_last_date = timestamp;
											couch_doc.mongo_synced = true;
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

										db.close();
										var result = {
											success:true,
											msg : "Invoice has been sent to client "+ doc.client_fname + " "+ doc.client_lname + " "+ doc.client_email,
											history : updated_doc.history
										};
										return res.send(result, 200);
									});

								});

							});

						});

					});

				});

			});

		});

	});

});
/*
 * Send Invoice
 * @url http://test.njs.remotestaff.com.au/send/invoice/?mongo_id=57445529531007b54a8b4567
 *
 */
router.post("/invoice", function(req,res,next){
	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");
	var couch_db = nano.use("client_docs");

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");


	var added_on = atz.toDate();

	//var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice.html');
	var search_key={"_id" : req.body.mongo_id};

	var custom_message = "";
	//var multiple_emails = [];
	var custom = req.body.custom;



	if(custom == true){
		var custom_message = req.body.custom_message;
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-with-custom-message.html');
	}else{
		var custom_message = "";
		var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice.html');
		//var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/base.html');
	}

	//if (typeof req.body.multiple_emails == "undefined" || req.body.multiple_emails ==""){
	//	var multiple_emails = [];
	//}



	console.log("custom => " + custom);
	//console.log("custom message => " + custom_message);
	db.once('open', function(){
		var promises = [];

		Invoice.findOne(search_key).exec(function(err, doc){
			if(err){
				db.close();
				var result = {success:false, msg : err};
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

			if(doc.pay_before_date){
				doc.pay_before_date_ordinal_string = moment(doc.pay_before_date).format("Do [of] MMMM YYYY");
			}

			var per_promise = [];
			function delay(){ return Q.delay(100); }

			doc.db = db;


			//Get Client Basic Info
			var promise_client_basic_info = doc.getClientInfo();

			//Get Client Current Available Balance
			var promise_running_balance = doc.getCouchdbAvailableBalance();

			//Get Client email invoice settings
			var promise_client_invoice_email_settings = doc.getClientInvoiceEmailSettings();

			per_promise.push(promise_client_basic_info);
			per_promise.push(delay);

			per_promise.push(promise_running_balance);
			per_promise.push(delay);

			per_promise.push(promise_client_invoice_email_settings);
			per_promise.push(delay);


			//Check all settled promises
			per_promises_promise = Q.allSettled(per_promise);
			promises.push(per_promises_promise);
			promises.push(delay);


			var allPromise = Q.allSettled(promises);
			allPromise.then(function(results){
				//console.log("All promises done!");
				//console.log(results);

				invoice = doc.getInvoice();
				console.log("days_before_suspension => " + invoice.client_basic_info.days_before_suspension);

				var output = template({
					doc : invoice,
					custom_message : custom_message
				});

				console.log("custom => " + custom);
				if(custom == true){
					to = req.body.multiple_emails;
					changes = "Custom Message Email sent to  " + to + " " + custom_message;
				}else{
					to=[];
					to.push(doc.client_email);
					changes = "Email sent to  " + to;
				}
				console.log(invoice.invoice_recipients);

				//Send email via mailbox
				var mailbox_doc = {
					bcc : null,
					cc : null,
					created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
					from : "Accounts<accounts@remotestaff.com.au>",
					sender : null,
					reply_to : null,
					generated_by : "NODEJS/send/invoice/",
					html : output,
					text : null,
					to : to,
					sent : false,
					subject : "Remotestaff Tax Invoice "+doc.order_id,
					is_invoice: true,
					order_id: doc.order_id
				};

				mailbox.insert(mailbox_doc, function(err, body){
					if (err){
						console.log(err.error);
						db.close();
						var result = {success:false, error : err.error};
						return res.send(result, 200);
					}
				});

				console.log("sent to mailbox");

				//db.close();
				//return res.send(output, 200);

				//TO DO :
				// - Add history
				var history = doc.history;
				var today = moment_tz().tz("GMT");
				var atz = today.clone().tz("Asia/Manila");
				var timestamp = atz.toDate();

				history.push({
					timestamp : timestamp,
					changes : changes,
					by : "Admin "+req.body.admin
				});
				doc.history = history;
				doc.sent_last_date = timestamp;
				//console.log(doc.history);

				//Update mongodb
				doc.save(function(err, updated_doc){
					if (err){
						console.log(err);
						db.close();
						var result = {success:false, error : err};
						return res.send(result, 200);
					}

					//Update Couchdb
					couch_db.get(doc.couch_id, { revs_info: true },function(err, couch_doc) {
						//console.log(couch_doc);
						console.log("couch_doc._rev : " + couch_doc._rev);
						updaterev = couch_doc._rev;
						couch_doc._rev = updaterev;


						//var timestamp = new Date().toJSON().replace('T', ' ').slice(0, -5);
						var today = moment_tz().tz("GMT");
						var atz = today.clone().tz("Asia/Manila");
						var timestamp = atz.toDate();

						//couch_doc.date_cancelled = timestamp;
						couch_doc.sent_last_date = timestamp;
						couch_doc.mongo_synced = true;
						var history = [];
						if(couch_doc.history){
							var history = couch_doc.history;
						}

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

					db.close();
					var result = {
						success:true,
						msg : "Invoice has been sent to client "+ doc.client_fname + " "+ doc.client_lname + " "+ doc.client_email,
						history : updated_doc.history
					};
					return res.send(result, 200);
				});




			});

		});
	});

});

/*
 * Send Quote Pro froma/SA proforma
 * @url http://test.njs.remotestaff.com.au/send/invoice/?ran=WkyX58uZIEZ7oTvbreH2ilthZHxdvJKCWL45A5K1XOAZoCH4Sj
 *
 */
router.post("/quote", type ,function(req,res,next){



	//
	// if(req.body.objectData)
	// {
	// 	req.body = 	JSON.parse(req.body.objectData);
	// }
	//
	var fs = require('fs');
	var files = req.files[0];
	var src = null;
	var dest = null;
	var attachments=[];


	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");

	var added_on = atz.toDate();
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/quote/quote.html');
	var cc = null;
	var subject = "Quote#"+req.body.quote_id;

	var result = {};

	var to = [];
	to.push(req.body.client_email);


	var output = template({
		quote : req.body
	});
	if(req.body.Cc)
	{
		cc = req.body.Cc;
	}
	if(req.body.Subject)
	{
		subject = req.body.Subject;
	}



	var mailbox_doc = {
		bcc : ["devs@remotestaff.com.au"] ,
		cc : [ cc ],
		created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
		from : req.body.email,
		sender : req.body.email,
		reply_to : null,
		generated_by : "NODEJS/send/quote/",
		html : output,
		text : null,
		to :to,
		sent : false,
		subject : subject
	};



	if(files)
	{
		var promises = [];
		mailbox_doc.sent = true;
		quoteComponent.getCouchID(mailbox_doc,true).then(function(couch_id){
			if(couch_id)
			{
				quoteComponent.attachFiles(couch_id, files).then(function (rev_val) {
					quoteComponent.updateMailbox(couch_id).then(function (response) {


						if(response)
						{


							result = {
								success: true,
								msg: "Email successfully sent!",
								couch_id: couch_id
							};

							quoteComponent.addHistory(req.body.adminID,req.body.sa_id,req.body.quote_id,'SEND');
							return res.status(200).send(result);
						}
						else
						{

							result = {
								success: false,
								msg: "Email sending failed!"
							};

							return res.status(200).send(result);
						}

					});
				});
			}
		});


		// function pushFiles(i)
		// {
		// 	var rev = null;
		// 	if(i < files.length)
		// 	{
		// 		f = files[i];
		//
		// 		quoteComponent.attachFiles(couch_id, f,rev).then(function (rev_val) {
		//
		// 			rev = rev_val;
		//
		// 			pushFiles(i+1);
		// 		});
		//
		// 	}
		// 	else
		// 	{
		// 		quoteComponent.updateMailbox(couch_id).then(function (response) {
		//
		// 			result = {
		// 				success: true,
		// 				msg: "Email successfully sent!",
		// 				couch_id: couch_id
		// 			};
		//
		// 			quoteComponent.addHistory(req.body.adminID,req.body.sa_id,req.body.quote_id,'SEND');
		// 			return res.status(200).send(result);
		//
		// 		});
		// 	}
		//
		// }
		// pushFiles(0);


	}
	else
	{
		mailbox.insert(mailbox_doc, function(err, body){
			if (err){
				console.log(err.error);
				db.close();
				var result = {success:false, error : err.error};
				return res.send(result, 200);
			}
			else {

				console.log(body);

				var result = {
					success:true,
					msg : "Email successfully sent!",
				};



				quoteComponent.addHistory(req.body.adminID,req.body.sa_id,req.body.quote_id,'SEND');
				return res.status(200).send(result);
			}
		});
	}





});


router.post("/sa-client", function(req,res,next){

	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");

	var added_on = atz.toDate();
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/service_agreement/sa.html');
	var cc = null;
	var subject = "Thank you "+req.body.client_fname+" "+req.body.client_lname+" for accepting Remote Staff Service Agreement #"+req.body.sa_id;


	var to = [];
	to.push(req.body.client_email);


	var output = template({
		sa : req.body
	});

	console.log(output);

	var mailbox_doc = {
		bcc : ["devs@remotestaff.com.au"],
		cc : [ cc ],
		created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
		from : "noreply@remotestaff.com.au",
		sender : req.body.sc_email,
		reply_to : null,
		generated_by : "NODEJS/send/sa-client/",
		html : output,
		text : null,
		to : to,
		sent : false,
		subject : subject
	};

	mailbox.insert(mailbox_doc, function(err, body){
		if (err){
			console.log(err.error);
			db.close();
			var result = {success:false, error : err.error};
			return res.send(result, 200);
		}
		else {
			var result = {
				success:true,
				msg : "Email successfully sent!",
			};
			return res.send(result, 200);
		}
	});


});

router.post("/sa-sc", function(req,res,next){

	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");

	var added_on = atz.toDate();
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/service_agreement/sc_mail.html');
	var cc = null;
	var subject = "Lead #"+req.body.client_id+" "+req.body.client_fname+" "+req.body.client_lname+" accepted Remote Staff Service Agreement #"+req.body.sa_id;



	var output = template({
		sa : req.body
	});



	var assigned_sc_email = req.body.sc_email;
	var all_sc_email = "orders@remotestaff.com.au";


	var to = [];
	to.push(all_sc_email);
	to.push('peachy@remotestaff.com.ph');
	to.push('staffingconsultants@remotestaff.com.au');

	console.log(output);

	var mailbox_doc = {
		bcc : ["devs@remotestaff.com.au"],
		cc : [ cc ],
		created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
		from : "noreply@remotestaff.com.au",
		sender : req.body.sc_email,
		reply_to : null,
		generated_by : "NODEJS/send/sa-sc/",
		html : output,
		text : null,
		to : to,
		sent : false,
		subject : subject
	};

	mailbox.insert(mailbox_doc, function(err, body){
		if (err){
			console.log(err.error);
			db.close();
			var result = {success:false, error : err.error};
			return res.send(result, 200);
		}
		else {
			var result = {
				success:true,
				msg : "Email successfully sent!",
			};
			return res.send(result, 200);
		}
	});


});



/**
 * Send email via sparkshot https://github.com/SparkPost/node-sparkpost
 *
 * @url http://test.njs.remotestaff.com.au/send/invoice-email-via-sparkshot/
 * @param couch_id The couch _id of mailbox/unsent
 *
 */
router.all("/invoice-email-via-sparkshot", function(req,res,next){

	var env = require("../config/env");

	if(!req.body.couch_id){
		return res.status(200).send({success:false, err: "couch_id is required!"});
	}


	var invoiceEmailResentSparkpostSchema = require("../models/InvoiceEmailResentSparkpost");
	var invoiceEmailResentSparkpostErrorsSchema = require("../models/InvoiceEmailResentSparkpostErrors");


	var db_invoice = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice",mongoCredentials.options);

	var InvoiceEmailResentSparkpost = db_invoice.model("InvoiceEmailResentSparkpost", invoiceEmailResentSparkpostSchema);
	var InvoiceEmailResentSparkpostErrors = db_invoice.model("InvoiceEmailResentSparkpostErrors", invoiceEmailResentSparkpostErrorsSchema);

	function delay(){ return Q.delay(100); }

	var sparkPostApiKey = "4dec1bd9155b43c6c664e97470d0e67e2310b69d";

	var SparkPost = require('sparkpost');
	var client = new SparkPost(sparkPostApiKey);


	var nano = configs.getCouchDb();
	var mailbox = nano.use("mailbox");

	var couch_id = req.body.couch_id;

	console.log(sparkPostApiKey);


	db_invoice.once('open', function() {
		mailbox.get(couch_id, { revs_info: true },function(err, couch_doc) {

			if(err){
				console.log(err);
				return res.status(200).send({success:false, err: "mail does not exist!"});
			}

			if(typeof couch_doc.is_invoice == "undefined"){

				return res.status(200).send({success:false, err: "Document is not an invoice!"});
			}

			if(!couch_doc.is_invoice){

				return res.status(200).send({success:false, err: "Document is not an invoice!"});
			}



			var options = {
				content: {
					from: 'noreply@remotestaff.com.au',
					subject: 'TEST',
					html: '',
					attachments: []
				},
				account_order_id: couch_doc.order_id,
				options: {
					open_tracking: true,
					click_tracking: true
				},
				recipients: [
				]
			};



			if(typeof couch_doc.from != "undefined" && couch_doc.from){
				options.content.from = couch_doc.from;
			}


			if(typeof couch_doc.subject != "undefined" && couch_doc.subject){
				options.content.subject = couch_doc.subject;
			}


			if(req.body.custom_message){
				options.content.html = req.body.custom_message + "<br/><br/>";
			}

			if(typeof couch_doc.html != "undefined" && couch_doc.html){
				options.content.html += couch_doc.html;
			} else{
				options.content.html += couch_doc.text;
			}


			if (env.environment=="production"){
				console.log("Sending Prod");
				//get recipients
				if(typeof couch_doc.to != "undefined"){
					if(couch_doc.to){
						couch_doc.to.forEach(function (item) {
							var new_recipient = {
								address: {
									email: item,
								},
								substitution_data: {
									recipient_type: 'Original'
								}
							};

							options.recipients.push(new_recipient);
						});
					}
				}


				if(typeof couch_doc.bcc != "undefined"){
					if(couch_doc.bcc){
						//get bcc
						couch_doc.bcc.forEach(function (item) {
							var new_recipient = {
								address: {
									email: item,
								},
								substitution_data: {
									recipient_type: 'BCC'
								}
							};

							options.recipients.push(new_recipient);
						});
					}
				}

				if(typeof couch_doc.cc != "undefined"){
					if(couch_doc.cc){
						//get cc
						couch_doc.cc.forEach(function (item) {
							var new_recipient = {
								address: {
									email: item,
								},
								substitution_data: {
									recipient_type: 'CC'
								}
							};

							options.recipients.push(new_recipient);
						});
					}
				}




			}else{
				console.log("Sending TEST");
				if(typeof couch_doc.subject != "undefined" && couch_doc.subject){
					options.content.subject = "TEST " + couch_doc.subject;
				}

				if(typeof couch_doc.to != "undefined") {
					if (couch_doc.to) {
						//get recipients
						couch_doc.to.forEach(function (item) {
							var new_recipient = {
								address: {
									email: "devs@remotestaff.com.au",
									//name: item
								},
								substitution_data: {
									recipient_type: 'Original'
								}
							};

							options.recipients.push(new_recipient);
						});
					}
				}



				options.recipients.push({
					address: {
						email: "devs@remotestaff.com.au",
						name: "devs@remotestaff.com.au"
					},
					substitution_data: {
						recipient_type: 'BCC'
					}
				});
			}

			//var reader = new FileReader();


			var allAttachmentFetchingDeferred = Q.defer();
			var allAttachmentFetchingPromise = allAttachmentFetchingDeferred.promise;

			if(typeof couch_doc._attachments != "undefined"){
				if(couch_doc._attachments){

					var fetch_attachments_promises = [];


					for(var key in couch_doc._attachments) {
						var fetchAttachmentDeferred = Q.defer();
						var fetchAttachmentPromise = fetchAttachmentDeferred.promise;
						fetch_attachments_promises.push(fetchAttachmentPromise);
						fetch_attachments_promises.push(delay);

						mailbox.attachment.get(couch_id, key, function(err, output) {
							if (!err) {

								var base64data = new Buffer(output).toString('base64');

								var attachment = {
									type: couch_doc._attachments[key]["content_type"],
									name: key,
									data: base64data
								};
								options.content.attachments.push(attachment);

							} else {
								console.log(err);
							}

							fetchAttachmentDeferred.resolve(key);
						});
					}



					var allPromise = Q.allSettled(fetch_attachments_promises);
					allPromise.then(function(results){

						console.log("All Attachment fetch done!");

						allAttachmentFetchingDeferred.resolve(true);
					});



				} else{
					allAttachmentFetchingDeferred.resolve(false);
				}
			} else{
				allAttachmentFetchingDeferred.resolve(false);
			}



			allAttachmentFetchingPromise.then(function(result){

				console.log("Attachments fetched: " + result);

				try{
					client.transmissions.send(options).then(function (data) {

						console.log('Woohoo! You just sent your sparkpost mailing!');
						console.log(data);

						InvoiceEmailResentSparkpost.findOne({order_id: couch_doc.order_id}).exec(function(err, counter){

							var counter_to_use = new InvoiceEmailResentSparkpost();
							if(counter){
								console.log("existing counter found!");
								counter_to_use = counter;
								counter.count += 1;
							} else{
								console.log("existing counter NOT found!");
								counter_to_use.count = 1;
								counter_to_use.order_id = couch_doc.order_id;
								counter_to_use.history = [];
							}

							var by = "Rs System";

							if(req.body.by){
								by = req.body.by;
							}

							var history = {
								by: by,
								date: new Date()
							};

							var changes = "Sent email via sparkpost.";
							if(req.body.reason_for_sending){
								changes += " Reason: " + req.body.reason_for_sending;
								history.reason = req.body.reason_for_sending;
							}

							counter_to_use.history.push(history);

							counter_to_use.addInvoiceHistory(couch_doc.order_id, changes, "RS System");

							counter_to_use.save(function(err){
								if(err){
									console.log(err);
								} else{
									console.log("Sparkpost invoice email counter updated for " + couch_doc.order_id);
								}
								db_invoice.close();
							});

						});

						return res.status(200).send({success:true});
					}).catch(function (err) {

						var error_in_sparkpost = new InvoiceEmailResentSparkpostErrors();

						error_in_sparkpost.couch_id = req.body.couch_id;
						error_in_sparkpost.errors_from_sparkpost = err;



						error_in_sparkpost.save(function(err){
							if(err){
								console.log(err);
							} else{
								console.log("Sparkpost invoice email error for " + req.body.couch_id);
							}
							db_invoice.close();
						});

						console.log('Whoops! Something went sparkpost-wrong');
						console.log(err);
						//db_invoice.close();
						return res.status(200).send({success:false});
					});
				} catch(err_sending){
					var error_in_sparkpost = new InvoiceEmailResentSparkpostErrors();

					error_in_sparkpost.couch_id = req.body.couch_id;
					error_in_sparkpost.errors_from_sparkpost = err_sending;



					error_in_sparkpost.save(function(err){
						if(err){
							console.log(err);
						} else{
							console.log("Sparkpost invoice email error for " + req.body.couch_id);
						}
						db_invoice.close();
					});

					return res.status(200).send({success:false});
				}



			});



		});
	});




});



module.exports = router;
