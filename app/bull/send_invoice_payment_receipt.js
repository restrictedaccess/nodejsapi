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
var swig  = require('swig');
var fs = require('fs');
var pdf = require('html-pdf');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var invoicePaymentsSchema = require("../models/InvoicePayments");
var send_invoice_payment_receipt_queue = Queue("send_invoice_payment_receipt_queue", 6379, '127.0.0.1');


send_invoice_payment_receipt_queue.process(function(job, done){
	console.log("Starting bull send_invoice_payment_receipt_queue process...");
	//done(null, {success:true});
	
	var couch_id = job.data.couch_id;
	console.log("Send receipt couch_id : "+ couch_id);


    var nano = configs.getCouchDb();
	var db_name = "mailbox";
  	var couch_db = nano.use(db_name);

    var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-receipt.html');  
    
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");	
    var search_key={couch_id : couch_id};
    var InvoicePayments = db.model("InvoicePayments", invoicePaymentsSchema);

    var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();

    db.once("open", function(){
        var promises = [];

        InvoicePayments.findOne(search_key).exec(function(err, doc){

            if(err){
            	console.log("invoice_payments document not found couch_id :" + couch_id);
            	console.log(err);
				db.close();
				done(null, {success:false});
			}
			
			if(doc == null){
            	console.log("Document is null " + couch_id);
            	done(null, {success:false});	
            }else{
				console.log("Retrieved document");
            
	            var per_promise = [];
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
				
				
				
	            
	            if(doc.total_amount){            	
					doc.total_amount_string = parseFloat(doc.total_amount).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
				}
				
				if(doc.input_amount){            	
					doc.input_amount_string = parseFloat(doc.input_amount).toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
				}
	
				doc.db = db;
	
	            //Get Client Basic Info
				var promise_client_basic_info = doc.getClientBasicInfo();
	            //Get Client Current Available Balance
				var promise_running_balance = doc.getCouchdbAvailableBalance();
	            //Get Client email invoice settings
				var promise_client_invoice_email_settings = doc.getClientInvoiceEmailSettings();
	            //Create HTML File
				//var promise_create_html_2_pdf = doc.createHTML2PDF();
	
	            per_promise.push(promise_client_basic_info);
				per_promise.push(delay);
	
				per_promise.push(promise_running_balance);
				per_promise.push(delay);
				
				per_promise.push(promise_client_invoice_email_settings);
				per_promise.push(delay);
				
				
				//per_promise.push(promise_create_html_2_pdf);
				//per_promise.push(delay);
	
	            //Check all settled promises
				per_promises_promise = Q.allSettled(per_promise);
				promises.push(per_promises_promise);
				promises.push(delay);
	
	            var allPromise = Q.allSettled(promises);
	            allPromise.then(function(results){
	                invoice = doc.getInvoice();
	                
	                doc.createHTMLInvoice(invoice).then(function(html_file){
	                    console.log(html_file);
	
	                    doc.convertHTML2PDF(html_file).then(function(pdf_file){
	                        console.log(pdf_file);
	
	                        var recipients=[];
	                        recipients = invoice.invoice_recipients;                        
	                        var output = template({
	                        	doc : invoice					
	                        });
	
	                        var today = moment_tz().tz("GMT");
					        var atz = today.clone().tz("Asia/Manila");
					        var timestamp = atz.toDate();
	
	                        to=[];    
	                        for(var i=0; i<recipients.length; i++){                                                       
	                            if(recipients[i].email !="" && recipients[i].email != null){                                                                                
	                                to.push(recipients[i].email);
	                            }
	                        }
	
							var bcc = [];
							bcc.push("devs@remotestaff.com.au");
	                        var mailbox_doc = {
	                            bcc : bcc,
	                            cc : null,
	                            created : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
	                            from : "Accounts<accounts@remotestaff.com.au>",
	                            sender : null,
	                            reply_to : null,
	                            generated_by : "NODEJS/send/invoice/",
	                            html : output,
	                            text : null,
	                            to : to,
	                            subject : "Remote Staff Payment Receipt #"+doc.receipt_number,                                 
	                        };
	
	
	
	                        //Insert document in couchdb mailbox
	                        doc.sendMailbox(mailbox_doc).then(function(mailbox_id){
	                            console.log("mailbox_id : " + mailbox_id);
	                            // Attach PDF
	                            doc.attachPDF(mailbox_id, pdf_file).then(function(pdf_filename){
	                                //Update mailbox document
	                                doc.updateMailboxDoc(mailbox_id).then(function(result){
	                                    
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
	
	                                    doc.sent_last_date = timestamp;
										
										
										//ADD HISTORY
	                       				doc.save(function(err, updated_doc){
	                                    	if (err){
	                                    		console.log(err);
	                                    		done(null, {success:false});
	                                    	}
	                                        console.log("Finished sending Invoice Receipt...");
	                                        done(null, {success:true});
	                                    });
	
	
	                                });
	                            });
	                        });
	
	                    });
	                });
	                 
	            });            	
            }

        });
    });
    

});

module.exports = send_invoice_payment_receipt_queue;