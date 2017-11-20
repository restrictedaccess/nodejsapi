var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');


var clientSchema = require("../models/Client");
var itemValueSchema = require("../models/ItemValue");
var runningBalanceSchema = require("../models/RunningBalance");
var subcontractorSchema = require("../models/Subcontractor");
var availableBalanceSchema = require("../models/AvailableBalance");
var Commission = require("../mysql/Commission");
var CommissionHistory = require("../mysql/CommissionHistory");

var ReadyForReleaseSchema = require("../models/ReadyToReleaseNotesModel");

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');
 
var insert_invoice_payments_queue = require("../bull/insert_invoice_payments");

var fields = {
	couch_id:{type:String},
    order_id:{type:String, required:true},
    client_id:{type:Number, required:true},
    items:Array,
    status:String,
    sent_flag:String,
    pay_before_date:{type:Date, required:true},
    added_on:Date,
    added_on_formatted:String,
    payment_advise:Boolean,
    client_fname : {type:String, required:true},
    client_lname : {type:String, required:true},
    client_email : {type:String, required:true},
    currency : {type:String, required:true},
    total_amount : {type:Number, required:true},
    added_on_string : String,
    pay_before_date_string : String,
    pay_before_date : Date,
    date_paid : String,
    date_cancelled : Date,
	date_cancelled_to_new : Date,
    comments:Array,
    history:Array,
    invoice_setup:String,
    pay_before_date_unix:{type:Number},
    sub_total:{type:Number, required:true},
    gst_amount:{type:Number, required:true},
    client_names:Array,
    apply_gst:String,
    running_balance:Number,
    added_by:{type:String, required:true},
    mongo_synced:Boolean,
    item_type:Array,
    disable_auto_follow_up:String,
    overpayment_from : String,
    overpayment_from_doc_id : String,
    type:String,
    last_date_updated:Date,
    date_paid_date:Date,
	set_paid_by : String,
	admin_id : Number,
	remarks : String,
	particular : String,
	client_company_name: String,
	client_company_address: String,
	client_officenumber: String,
	client_abn_number:String
	//company_name : String,
	//company_address : String,
	//officenumber : String,
	//mobile : String
};


var invoiceSchema = new Schema(fields,
{collection:"client_docs"});



invoiceSchema.methods.updateCommission = function(admin_id){

	
	var me = this;
	var promises = [];
	var items = [];
		
	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var timestamp = atz.toDate();
	
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
	var couch_db = nano.use(db_name);
	var order_id = this.order_id;
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	//Consider item_type 
	var selected_item_types = [ "Commissions", "Commission"];
	if (typeof this.items != undefined){
		for(var i=0;i<this.items.length;i++){
			var item = this.items[i];
			if (typeof item.item_type != undefined){
				//console.log(item.item_type);			
				
				if (selected_item_types.indexOf(item.item_type) >= 0) {				
					if (typeof item.commission_id != undefined && item.commission_id != "" && item.commission_id != null && !isNaN(item.commission_id)){
						console.log("Found Commission ID " + item.commission_id);	
						
						function updateComm(item){
							var willFulfillDeferred = Q.defer();
							var willFulfill = willFulfillDeferred.promise;
							setTimeout(function(){			
								
								Commission.updateCommission(item.commission_id).then(function(result){
									CommissionHistory.insertHistory(item.commission_id, order_id, admin_id).then(function(result){
										willFulfillDeferred.resolve(item.commission_id);	
									}).catch(function(err){
										willFulfillDeferred.reject(err);
									});																																										
								}).catch(function(err){
									willFulfillDeferred.reject(err);
								});										
								
							}, 100);
							return willFulfill;
						}
		
		
						var promise = updateComm(item);
						promises.push(promise);
						function delay(){ return Q.delay(100); }
						promises.push(delay);
						promise.then(function(itemValue){						
							items.push(itemValue);
						});
							
					}
				}
			}	
		}	
	}
	

	Q.allSettled(promises).then(function(response){
		console.log("All settled promises");
		me.commissions = items;
		willFulfillDeferred.resolve(items);
	});		
	return willFulfill;

};


invoiceSchema.methods.getClientAssignedSC2 = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;
	mysql_connection.connect();	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query="SELECT a.admin_fname, a.admin_lname, a.admin_email FROM leads l JOIN admin a ON l.csro_id = a.admin_id WHERE l.id=?;";		
	mysql_connection.query(query, [id], function(err, admin) {
		me.staffing_consultant = admin[0];
		willFulfillDeferred.resolve(admin[0]);		
		mysql_connection.end();
	});
	
	return willFulfill;
};

invoiceSchema.methods.saveMailboxDoc = function(mailbox_doc){
	var fs = require('fs');
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	var pdf_file = me.pdf_file;	
	var html_file = me.html_file;
	var pdf_filename = "invoice-"+me.order_id+".pdf";

	db.insert(mailbox_doc, function(err, body){
        if (err) {
       		console.error(err);
       		willFulfillDeferred.reject(err);
   		}
   		console.log("saved to mailbox");

        var couch_id = body.id;
        db.get(couch_id, function(err, mailbox_doc) {
			if (err) {
	       		console.error(err);
	       		willFulfillDeferred.reject(err);
	   		}
	
	        updaterev = mailbox_doc._rev;
	        mailbox_doc._rev = updaterev;
	
	        fs.readFile(pdf_file, function(err, data) {
				if (err) {
	       			console.error(err);
	       			willFulfillDeferred.reject(err);
	   			}
	
	   			db.attachment.insert( couch_id, pdf_filename, new Buffer(data, "binary"), 'application/octet-stream', {rev: mailbox_doc._rev}, function(err, body) {
	   				 if (err) {
	       				console.error(err);
	       				willFulfillDeferred.reject(err);
	   				 }	   				 
					 console.log("File attached.");
			         //willFulfillDeferred.resolve(pdf_filename);
			         
			         db.get(couch_id, function(err, mailbox_doc) {
						if (err) {
				       		console.error(err);
				       		willFulfillDeferred.reject(err);
				   		}
				
				   		mailbox_doc.sent = false;
						db.insert( mailbox_doc, couch_id, function(err, body) {
							if (err){
						        willFulfillDeferred.reject(err);
						    }
						    console.log("Mailbox document updated");
						    
						    willFulfillDeferred.resolve(body);
						});

					});
			         
	   			});
	
			});
	
	     });
     });
     return willFulfill;
     
};


invoiceSchema.methods.getClientInvoiceEmailSettings = function(){
	
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;	
	mysql_connection.connect();
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var MongoClient = require('mongodb').MongoClient;

	MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
		var client_settings_collection = db.collection("client_settings");
		var filter = {client_id:parseInt(id)};
		client_settings_collection.find(filter).toArray(function(err, doc){
			if (err){
				console.log(err);
				willFulfillDeferred.reject(err);
			}

			var unique_emails=[];
			var recipients_leads_column_name=[];
			var lead = doc[0].lead;
			//console.log("Lead \n" + lead.email);

			//Check if the client has an existing send invoice setting
			var query = "SELECT id, default_email_field, cc_emails  FROM  leads_send_invoice_setting WHERE leads_id=?;";
			mysql_connection.query(query, [id], function(err, row) {
				if (err){
					console.log(err);
					willFulfillDeferred.reject(err);
				}
				if(row[0] != null){
					console.log("Client has an existing Invoice email settings;");
					
					if(row[0].default_email_field != null){
						recipients_leads_column_name.push(row[0].default_email_field);
					}
					
					if(row[0].cc_emails != null){			
						var res = row[0].cc_emails.split(",");
						for(var i=0; i<res.length; i++){
							recipients_leads_column_name.push(res[i]);
						}			 
					}

				   
					for(var i=0; i<recipients_leads_column_name.length; i++){
						if(recipients_leads_column_name[i] != "" && recipients_leads_column_name != null){
							//console.log("recipient : " + recipients_leads_column_name[i]);
							for (var key in lead) {
								if(key == recipients_leads_column_name[i]){
									//console.log("key " + key + " has value " + lead[key]);
									
									//Check if null or empty string
									if(lead[key] != null && lead[key] != ""){
										unique_emails.push({email : lead[key], client_recipient : true});
										break;	
									}
									
								}  								
							}
						}
					}

					//Add accounts
					unique_emails.push({email : "accounts@remotestaff.com.au", client_recipient : false});
					
					//Add Staffing Consultant
					var query3="SELECT admin_email FROM admin WHERE admin_id=?;";		
					mysql_connection.query(query3, [lead.csro_id], function(err, admin) {						
						unique_emails.push({email : admin[0].admin_email, client_recipient : false});					
						console.log(unique_emails);		
						me.invoice_recipients = unique_emails;
						willFulfillDeferred.resolve(unique_emails);		
						db.close();	
						mysql_connection.end();
					});

				}else{

					console.log("Client has no email invoice settings");
					var query="SELECT l.email, a.admin_email FROM leads l JOIN admin a ON l.hiring_coordinator_id = a.admin_id WHERE l.id=?;";		
					mysql_connection.query(query, [id], function(err, row) {
						
						console.log(row);
						var unique_emails=[];						
						unique_emails.push({email : row[0].email, client_recipient : true});						
						unique_emails.push({email : "accounts@remotestaff.com.au", client_recipient : false});						
						unique_emails.push({email : row[0].admin_email, client_recipient : false});
						me.invoice_recipients = unique_emails;
						willFulfillDeferred.resolve(unique_emails);	
						db.close();		
						mysql_connection.end();
					});

				}
			});



			//unique_emails.push({email : "accounts@remotestaff.com.au", client_recipient : false});
			//me.invoice_recipients = unique_emails;
			//willFulfillDeferred.resolve(unique_emails);
			db.close();
		});
	});
	return willFulfill;
};

invoiceSchema.methods.createHTML2PDF = function(){
	var swig  = require('swig');
	var fs = require('fs');
	var pdf = require('html-pdf');
	

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
  	var today = moment(today).year()+"_"+(moment(today).month()+1)+"_"+moment(today).date()+"_"+moment(today).hour()+"_"+moment(today).minute()+"_"+moment(today).second();

    //Crete template
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-attachment-v2.html');
	var output = template({
		doc : me
	});

	var path = '/home/remotestaff/tmp/'; 
	
	//html file
	var html_filename = "invoice-"+me.order_id+".html";	
	var html_file = path+""+html_filename;
	
	//pdf file
	var pdf_filename = "invoice-"+me.order_id+".pdf";		
	var pdf_file = path+""+pdf_filename;
	
	
	fs.open(html_file, 'w+', function(err, fd) {
    	if (err) {
    		console.log(err);
    		willFulfillDeferred.reject(err);
    	}

    	console.log("HTML file created => "+html_filename);
		fs.writeFile(html_file, output,  function(err) {
	   		if (err) {
	       		console.error(err);
	       		willFulfillDeferred.reject(err);
	   		}
	   		console.log("Invoice content written successfully!");
	   		me.html_file = html_file;
	   		
	   		//Start converting html to pdf file
	   		var html = fs.readFileSync(html_file, 'utf8');    
		    var options = {
		        filename: pdf_file,
		        format: 'Tabloid',
		        type: "pdf",
		        "font-family": "Calibri",
		        "border": {
				    "top": "1in", 
				    "right": ".5in",
				    "bottom": "1in",
				    "left": ".5in"
				}
		    };
	   		
	   		pdf.create(html, options).toFile(function(err, result) {		    
		    	if (err) {
		       		console.error(err);
		       		willFulfillDeferred.reject(err);
		   		}
		   		console.log("PDF Invoice created successfully!");		   		
		   		me.pdf_file = pdf_file;
		   		willFulfillDeferred.resolve(pdf_file);
		    });	   		
	   		//End converting html to pdf file
	   		
    	});


    	fs.close(fd, function(err){
        	if (err){
           		console.log(err);
         	}
         	console.log("File closed successfully.");
      	});
	});



	return willFulfill;
};

invoiceSchema.methods.createHTMLInvoice = function(print){
	var swig  = require('swig');
	var fs = require('fs');
	var pdf = require('html-pdf');

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
  	var today = moment(today).year()+"_"+(moment(today).month()+1)+"_"+moment(today).date()+"_"+moment(today).hour()+"_"+moment(today).minute()+"_"+moment(today).second();

    //Crete template
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-attachment-v2.html');
	var output = template({
		doc : me,
	});

	console.log('w/attachemtns');
	console.log(me.client_basic_info);

	if(typeof print !== "undefined" && print)
	{
		willFulfillDeferred.resolve(output);
		return willFulfill;
	}

	//Create html file
	var html_filename = "invoice-"+me.order_id+".html";
	var path = '/home/remotestaff/tmp/'; //configs.getEmailTemplatesPath()+"/invoice/tmp/";
	var html_file = path+""+html_filename;
	fs.open(html_file, 'w+', function(err, fd) {
    	if (err) {
    		console.log(err);
    		willFulfillDeferred.reject(err);
    	}

    	console.log("HTML file created => "+html_filename);
		fs.writeFile(html_file, output,  function(err) {
	   		if (err) {
	       		console.error(err);
	       		willFulfillDeferred.reject(err);
	   		}
	   		console.log("Invoice content written successfully!");
	   		me.html_file = html_file;
	   		willFulfillDeferred.resolve(html_file);
    	});


    	fs.close(fd, function(err){
        	if (err){
           		console.log(err);
         	}
         	console.log("File closed successfully.");
      	});
	});



	return willFulfill;
};


invoiceSchema.methods.convertHTML2PDF = function(html_file){

	var fs = require('fs');
	var pdf = require('html-pdf');

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;


	var pdf_filename = "invoice-"+me.order_id+".pdf";	
	var path = '/home/remotestaff/tmp/';
	var pdf_file = path+""+pdf_filename;
	
	console.log("Converting HtML to PDF");
	var html = fs.readFileSync(html_file, 'utf8');
    //var options = { format: 'Letter' };
    var options = {

        filename: pdf_file,
        format: 'Tabloid',
        type: "pdf",
        "font-family": "Calibri",
        "border": {
		    "top": "1in", 
		    "right": ".5in",
		    "bottom": "1in",
		    "left": ".5in"
		}
    };

    pdf.create(html, options).toFile(function(err, result) {
    //pdf.create(html, options).toFile(path+""+pdf_filename, function(err, result) {
    	if (err) {
       		console.error(err);
       		willFulfillDeferred.reject(err);
   		}
   		console.log("PDF Invoice created successfully!");
   		//console.log(result);
   		me.pdf_file = pdf_file;
   		willFulfillDeferred.resolve(pdf_file);
    });


	return willFulfill;
};

invoiceSchema.methods.sendMailbox = function(mailbox_doc){
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	db.insert(mailbox_doc, function(err, body){
        if (err) {
       		console.error(err);
       		willFulfillDeferred.reject(err);
   		}
   		console.log("saved to mailbox");

        var couch_id = body.id;
        willFulfillDeferred.resolve(couch_id);

     });
     return willFulfill;

};

invoiceSchema.methods.attachPDF = function(couch_id, pdf_file){
	var fs = require('fs');
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var pdf_filename = "invoice-"+me.order_id+".pdf";

	db.get(couch_id, function(err, mailbox_doc) {
		if (err) {
       		console.error(err);
       		willFulfillDeferred.reject(err);
   		}

        updaterev = mailbox_doc._rev;
        mailbox_doc._rev = updaterev;

        fs.readFile(pdf_file, function(err, data) {
			if (err) {
       			console.error(err);
       			willFulfillDeferred.reject(err);
   			}

   			db.attachment.insert( couch_id, pdf_filename, new Buffer(data, "binary"), 'application/octet-stream', {rev: mailbox_doc._rev}, function(err, body) {
   				 if (err) {
       				console.error(err);
       				willFulfillDeferred.reject(err);
   				 }
   				 //console.log(body);
				 console.log("File attached.");
		         willFulfillDeferred.resolve(pdf_filename);
   			});

		});

     });

     return willFulfill;

};


invoiceSchema.methods.updateMailboxDoc = function(couch_id){

	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	db.get(couch_id, function(err, mailbox_doc) {
		if (err) {
       		console.error(err);
       		willFulfillDeferred.reject(err);
   		}

   		mailbox_doc.sent = false;
		db.insert( mailbox_doc, couch_id, function(err, body) {
			if (err){
		        willFulfillDeferred.reject(err);
		    }
		    console.log("Mailbox document updated");
		    willFulfillDeferred.resolve(body);
		});

    });

    return willFulfill;

};


invoiceSchema.methods.saveMongodbPayment = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	
	me.save(function(err, updated_doc){
  		if (err){
	  		console.log(err);
	  	}	  	
	  	willFulfillDeferred.resolve(updated_doc);
	});

	return willFulfill;
};

invoiceSchema.methods.saveCouchdbPayment = function(){
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
  	console.log(this.by);
  	var date_paid = this.date_paid;
  	var by = this.by;
  	var admin_id = this.admin_id;
	var remarks = this.remarks;  
	var particular = this.particular;
	var input_amount = this.credit;
  	//Update Couchdb
	//console.log("invoiceSchema.methods.saveCouchdbPayment couch_id : " + this.couch_id);
	db.get(this.couch_id, { revs_info: true }, function(err, couch_doc) {

		if(err){
			console.log(err);
		}else{
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

			//updaterev = couch_doc._rev;
			//couch_doc._rev = updaterev;
			couch_doc.input_amount = input_amount;
			couch_doc.status = "paid";			
			couch_doc.date_paid = date_paid;
			couch_doc.mongo_synced = false;
			couch_doc.admin_id = admin_id;	
			couch_doc.set_paid_by = "admin";
			couch_doc.admin_name = by;
			couch_doc.remarks = remarks;
			couch_doc.particular = particular;			
			var history = couch_doc.history;

			history.push({
				timestamp : timestamp,
				changes : "Set status to paid and set date_paid to " + date_paid,
				by : "Admin " + by
			});
			couch_doc.history = history;
			db.insert( couch_doc, this.couch_id, function(err, body) {
				if (err){
						console.log(err.error);
				}				
				willFulfillDeferred.resolve(body);
				console.log("insert_invoice_payments_queue couch_id : " + body.id);
				insert_invoice_payments_queue.add({couch_id : body.id});
			});

			
		}

  	});


  	return willFulfill;
};

invoiceSchema.methods.saveRunningBalance = function(){

	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	var RunningBalance;
	try{
		RunningBalance = this.db.model("RunningBalance", runningBalanceSchema);
	}catch(e){
		RunningBalance = mongoose.model("RunningBalance", runningBalanceSchema);
	}

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	var id = this.client_id;

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var timestamp = atz.toDate();

	console.log("Saving invoice total amount =>" + me.total_amount);
	//console.log(me.credit +" - "+me.total_amount);

	//Get running balance
	var queryOptions = {key : parseInt(id)};


		couch_db.view('client','running_balance', queryOptions, function(err, view) {
	    	//if (err) throw err;
	    	if (err){
				willFulfillDeferred.reject(err);
			}

	    	//callback(view);
	    	var running_balance = 0;
	    	if (typeof view.rows[0] != "undefined"){
	    		running_balance = view.rows[0].value;
	    	}
	    	running_balance = parseFloat(running_balance);
	    	console.log("Running Balance => " + running_balance);

	    	var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var timestamp = atz.toDate();

	    	var doc = {
				credit : me.total_amount,
				currency : me.currency,
				credit_type : me.credit_type,
				client_id : me.client_id,
				charge : parseFloat("0.00"),
				particular : me.particular,
				remarks : me.remarks,
				type : "credit accounting",
				added_by : me.by,
				added_on : timestamp,
				running_balance : running_balance
			};
	    	var mongo_doc = new RunningBalance(doc);
			//console.log(mongo_doc);


	    	//Insert new document in Mongodb
	    	mongo_doc.save(function(err){
				if (err){
					willFulfillDeferred.reject(err);
				}

			  	//Insert new document in Couchdb
			  	doc.charge = ""+doc.charge;
			  	doc.credit = ""+doc.credit;
			  	doc.running_balance = ""+running_balance;
			  	doc.added_on =  [moment(doc.added_on).year(), moment(doc.added_on).month()+1, moment(doc.added_on).date(), moment(doc.added_on).hour(), moment(doc.added_on).minute(), moment(doc.added_on).second()] ;
			  	couch_db.insert(doc, function(err, body){

					mongo_doc.couch_id = body.id;
					mongo_doc.save(function(err){
						//db.close();
						willFulfillDeferred.resolve(body);
					});
				});
			});

	  	});






	return willFulfill;
};



invoiceSchema.methods.saveOverPayment = function(){

	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	var RunningBalance;
	try{
		RunningBalance = this.db.model("RunningBalance", runningBalanceSchema);
	}catch(e){
		RunningBalance = mongoose.model("RunningBalance", runningBalanceSchema);
	}

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	var id = this.client_id;

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var timestamp = atz.toDate();

	//Check if overpayment
	var meCredit = parseFloat(me.credit);
	var meTotalAmount = parseFloat(me.total_amount);
	if(meCredit.toFixed(2) > meTotalAmount.toFixed(2)){
		console.log("Overpayment detected. Lodging to Client RBS");

		var over_payment = parseFloat(me.credit) - parseFloat(me.total_amount);

		//Get running balance
		var queryOptions = {key : parseInt(id)};

		setTimeout(function(){
			couch_db.view('client','running_balance', queryOptions, function(err, view) {
		    	//if (err) throw err;
		    	if (err){
					willFulfillDeferred.reject(err);
				}

		    	//callback(view);
		    	var running_balance = 0;
		    	if (typeof view.rows[0] != "undefined"){
		    		running_balance = view.rows[0].value;
		    	}
		    	running_balance = parseFloat(running_balance);
		    	console.log("Running Balance => " + running_balance);

		    	var today = moment_tz().tz("GMT");
				var atz = today.clone().tz("Asia/Manila");
				var timestamp = atz.toDate();


		    	var doc = {
					credit : over_payment,
					currency : me.currency,
					credit_type : me.credit_type,
					client_id : me.client_id,
					charge : parseFloat("0.00"),
					particular : "Over Payment",
					remarks : "Over payment from Invoice #" + me.order_id,
					type : "credit accounting",
					added_by : me.by,
					added_on : timestamp,
					running_balance : running_balance
				};
		    	var mongo_doc = new RunningBalance(doc);
				//console.log(mongo_doc);


		    	//Insert new document in Mongodb
		    	mongo_doc.save(function(err){
					if (err){
						willFulfillDeferred.reject(err);
					}

				  	//Insert new document in Couchdb
				  	doc.charge = ""+doc.charge;
				  	doc.credit = ""+doc.credit;
				  	doc.running_balance = ""+running_balance;
				  	doc.added_on =  [moment(doc.added_on).year(), moment(doc.added_on).month()+1, moment(doc.added_on).date(), moment(doc.added_on).hour(), moment(doc.added_on).minute(), moment(doc.added_on).second()] ;
				  	couch_db.insert(doc, function(err, body){

						mongo_doc.couch_id = body.id;
						mongo_doc.save(function(err){
							//db.close();
							console.log("Lodged to Client RBS");
							willFulfillDeferred.resolve(body);
						});
					});
				});

		  	});


		}, 1000);
	}else{
		willFulfillDeferred.resolve({success : true});
	}




	return willFulfill;
};

invoiceSchema.methods.getMongoClient = function(){
	var Client;
	try{
		Client = this.db.model("Client", clientSchema);
	}catch(e){
		Client = mongoose.model("Client", clientSchema);
	}
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	Client.findOne({client_id:this.client_id}).exec(function(err, client){
		willFulfillDeferred.resolve(client);
	});
	return willFulfill;
};

invoiceSchema.methods.generateNewInvoice = function(){
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);


	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	var id = this.client_id;

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var timestamp = atz.toDate();

    var meCredit = parseFloat(me.credit);
    var meTotalAmount = parseFloat(me.total_amount);
    if(meCredit.toFixed(2) > meTotalAmount.toFixed(2)){
		console.log("Overpayment detected creating new Invoice");
		var db_value = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
		var Invoice;
		try{
			Invoice = db_value.model("Invoice", invoiceSchema);
		}catch(e){
			Invoice = mongoose.model("Invoice", invoiceSchema);
		}

		var filter = {client_id:this.client_id};
		Invoice.findOne(filter).sort({added_on:-1}).exec(function(err, invoice){
			if (err){
				willFulfillDeferred.reject(err);
			}

			var last_order_id = parseInt(invoice.order_id.split("-")[1]);
			function pad(n, width, z) {
			  z = z || '0';
			  n = n + '';
			  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
			}

			var new_order_id = me.client_id+"-"+pad(last_order_id+1, 8);
			console.log(new_order_id);

			//Get running balance
			var queryOptions = {key : parseInt(id)};
			couch_db.view('client','running_balance', queryOptions, function(err, view) {
		    	if (err){
					willFulfillDeferred.reject(err);
				}

		    	//callback(view);
		    	var running_balance = 0;
		    	if (typeof view.rows[0] != "undefined"){
		    		running_balance = view.rows[0].value;
		    	}
		    	running_balance = parseFloat(running_balance);
		    	//console.log("Running Balance => " + running_balance);

		    	var today = moment_tz().tz("GMT");
				var atz = today.clone().tz("Asia/Manila");
				var timestamp = atz.toDate();

				var difference = parseFloat(0);
				var gst_amount = parseFloat(0);

				var difference = parseFloat(me.credit) - parseFloat(me.total_amount);
				var sub_total = difference;

				if(me.apply_gst == "Y"){
					var gst_amount = difference * .10;
					var sub_total = difference - gst_amount;
				}

		    	var doc = {
					added_by : me.by,
					//added_on : [moment(this.added_on).year(), moment(this.added_on).month()+1, moment(this.added_on).date(), moment(this.added_on).hour(), moment(this.added_on).minute(), moment(this.added_on).second()],
					added_on : timestamp,
					apply_gst : me.apply_gst,
					client_email : me.client_email,
					client_fname : me.client_fname,
					client_id : me.client_id,
					client_lname : me.client_lname,
					comments : [],
					currency : me.currency,
					history : [{
						timestamp : timestamp,
						by : me.by,
						changes : "Over payment"
					}],
					items: [{
				       item_id: 1,
				       amount : parseFloat(sub_total),
				       description : "Overpayment from Invoice #" + me.order_id,
				       unit_price: parseFloat(sub_total),
				       qty: 1,
				       item_type : "Over Payment"

				    }],
					order_id : new_order_id,
					overpayment_from : me.order_id,
					overpayment_from_doc_id : me.couch_id,
					mongo_synced:false,
					running_balance : running_balance,
					status : "paid",
					gst_amount : parseFloat(gst_amount),
					sub_total : parseFloat(sub_total),
					total_amount : parseFloat(difference),
					type : "order",
					over_payment : true,
					pay_before_date : timestamp
				};
		    	//console.log(doc);
		    	var mongo_doc = new Invoice(doc);
				//console.log(mongo_doc);

				//Insert new document in Mongodb
		    	mongo_doc.save(function(err){
		    		console.log(err);
					if (err){
						willFulfillDeferred.reject(err);
					}

				  	//Insert new document in Couchdb
				  	doc.added_on =  [moment(doc.added_on).year(), moment(doc.added_on).month()+1, moment(doc.added_on).date(), moment(doc.added_on).hour(), moment(doc.added_on).minute(), moment(doc.added_on).second()] ;
				  	couch_db.insert(doc, function(err, body){

						mongo_doc.couch_id = body.id;
						mongo_doc.save(function(err){
							//db.close();
							console.log("New Invoice Generated : " + new_order_id);
							db_value.close();
							console.log("insert_invoice_payments_queue couch_id : " + body.id);
							insert_invoice_payments_queue.add({couch_id : body.id});
							willFulfillDeferred.resolve(body);
						});
					});
				});


		  	});
		});
	}else{
		willFulfillDeferred.resolve({success : true});
	}


	return willFulfill;
};


invoiceSchema.methods.getInvoice = function(){
	//console.log(this.client);
	var temp = this;
	var client_basic_info = this.client_basic_info;
	var running_balance = this.running_balance;
	var running_balance_str = this.running_balance_str;
	var invoice_recipients = this.invoice_recipients;
	var html_file = this.html_file;
	var pdf_file = this.pdf_file;
	
	temp.client_basic_info = client_basic_info;
	temp.running_balance = running_balance.toFixed(2);
	temp.invoice_recipients = invoice_recipients;
	temp.html_file = html_file;
	temp.pdf_file = pdf_file;


	return temp;
};



invoiceSchema.methods.updateCouchdbDocument = function(fields){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	//console.log(fields);
	var output = {
		added_by:this.added_by,
		added_on:[moment(this.added_on).year(), moment(this.added_on).month()+1, moment(this.added_on).date(), moment(this.added_on).hour(), moment(this.added_on).minute(), moment(this.added_on).second()],
		apply_gst:this.apply_gst,
		client_email:this.client_email,
		client_fname:this.client_fname,
		client_id:this.client_id,
		client_lname:this.client_lname,
		comments:this.comments,
		currency:this.currency,
		gst_amount:this.gst_amount,
		history:this.history,
		items:this.items,
		order_id:this.order_id,
		mongo_synced:false,
		running_balance:this.running_balance,
		sent_flag:this.sent_flag,
		status:this.status,
		sub_total:this.sub_total,
		total_amount:this.total_amount,
		type:this.type
	};

	if (typeof this.pay_before_date != "undefined" && this.pay_before_date){
		output.pay_before_date = [moment(this.pay_before_date).year(), moment(this.pay_before_date).month()+1, moment(this.pay_before_date).date(), moment(this.pay_before_date).hour(), moment(this.pay_before_date).minute(), moment_tz(this.pay_before_date).second()]
	}

	for(var i=0;i<output.history.length;i++){
		output.history[i].timestamp = moment(output.history[i].timestamp).format("YYYY-MM-DD HH:mm:ss");
	}
	for(var i=0;i<output.items.length;i++){
		var start_date = output.items[i].start_date;
		var end_date = output.items[i].end_date;
		output.items[i].start_date = [moment(start_date).year(), moment(start_date).month()+1, moment(start_date).date()];
		output.items[i].end_date = [moment(end_date).year(), moment(end_date).month()+1, moment(end_date).date()];

	}

	var client_docs_db = nano.use("client_docs");

	if (this.couch_id){
		client_docs_db.get(this.couch_id, { revs_info: true },function(err, body){
			if (err){
				console.log(err);
			}
			output._id = me.couch_id;
			output.rev = body['_rev'];
			output._rev = body['_rev'];
			
			console.log("Saving Invoice to couchdb "+me.couch_id);
			// console.log(output);
			//console.log(output);
			client_docs_db.insert(output, function(err, body){
				
				console.log(err);
				console.log("Save output");
				// console.log(body);
				willFulfillDeferred.resolve(body);
			});
		});

	}else{
		console.log("Saving Invoice to couchdb ");
		//console.log(output);
		client_docs_db.insert(output, function(err, body){
			willFulfillDeferred.resolve(body);
		});
	}



	return willFulfill;
};


invoiceSchema.methods.getClientSettings = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var client_id = me.client_id
	//console.log(client_id);

	var Client;
	try{
		Client = this.db.model("Client", clientSchema);
	}catch(e){
		Client = mongoose.model("Client", clientSchema);
	}

	var filter = {client_id:this.client_id};

	Client.findOne(filter).exec(function(err, setting){
		//console.log(err);
		//console.log(setting);
		willFulfillDeferred.resolve(setting);
	});


	return willFulfill;

};

invoiceSchema.methods.getClient = function(){
	var client = {};
	client.id = this.client_id;
	client.name = this.client_fname + " " + this.client_lname;
	client.email = this.client_email;
	client.currency = this.currency;
	return {
		client:client
	};
};

invoiceSchema.methods.addItem = function(item){
	this.items.push(item);
};

invoiceSchema.methods.getSubTotal = function(){

	var amount = this.items.reduce(function(previous_item, next_item){
		return {amount:previous_item.amount+next_item.amount};
	});
	return amount.amount;
};

invoiceSchema.methods.getGSTAmount = function(){
	var sub_total = this.getSubTotal();
	if (this.apply_gst=="Y"){
		return sub_total * .1;
	}else{
		return 0;
	}
};

invoiceSchema.methods.getBasic = function(){
	var data = {
		order_id:this.order_id,
		couch_id:this.couch_id,
		status:this.status,
		pay_before_date:this.pay_before_date,
		total_amount:this.total_amount,
		added_on:this.added_on,
		added_on_string:this.added_on_string,
		pay_before_date_string:this.pay_before_date_string,
	};

	return data;
};




invoiceSchema.methods.getCouch = function(){
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

  	db.get(this.couch_id, function(err, body){
  		willFulfillDeferred.resolve(body);
  	});
  	return willFulfill;
};

invoiceSchema.methods.getClientInfo = function(){
	/*
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;

	mysql_connection.connect();

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var query = "SELECT id, fname, lname, email, company_name, company_address, officenumber, mobile, supervisor_email, acct_dept_email1, acct_dept_email2, sec_email FROM leads  WHERE id = ?";

	mysql_connection.query(query, [id], function(err, client_basic_info) {
		if (err){
			willFulfillDeferred.reject(err);
		}



		me.client_basic_info = client_basic_info;
		willFulfillDeferred.resolve(client_basic_info);
      	mysql_connection.end();
	});

	return willFulfill;
	*/
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var client_id = this.client_id;
	var me = this;
	var MongoClient = require('mongodb').MongoClient;
	MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
		var client_settings_collection = db.collection("client_settings");
		var filter = {client_id:parseInt(client_id)};
		client_settings_collection.find(filter).toArray(function(err, client_basic_info) {
			if (err) {
				willFulfillDeferred.reject(err);
			}
			//console.log(client_basic_info);
			try {
				client_basic_info = client_basic_info[0];
				delete client_basic_info.full_content;
				var basic_info = {
					fname : client_basic_info.client_doc.client_fname,
					lname : client_basic_info.client_doc.client_lname,
					email : client_basic_info.client_doc.client_email,
					company_name : client_basic_info.lead.company_name,
					company_address : client_basic_info.lead.company_address,
					officenumber : client_basic_info.lead.officenumber,
					mobile : client_basic_info.lead.mobile,
					supervisor_email : client_basic_info.lead.supervisor_email,
					acct_dept_email1 : client_basic_info.lead.acct_dept_email1,
					acct_dept_email2 : client_basic_info.lead.acct_dept_email2,
					sec_email : client_basic_info.lead.sec_email,
					days_before_suspension : client_basic_info.client_doc.days_before_suspension,
					isActive : client_basic_info.lead.active,
					lead_fname : client_basic_info.lead.fname,
					lead_lname : client_basic_info.lead.lname,
				};
				me.client_company_name = client_basic_info.lead.company_name;
				me.client_officenumber = client_basic_info.lead.officenumber;
				me.client_abn_number = client_basic_info.lead.abn_number;
				me.client_company_address = client_basic_info.lead.company_address;


				//console.log(basic_info);
				me.client_basic_info = basic_info;
				db.close();
				willFulfillDeferred.resolve(basic_info);
			}catch (e)
			{
				console.log(filter);
				willFulfillDeferred.reject(e);
			}

		});
	});


	return willFulfill;
};

invoiceSchema.methods.getCouchdbAvailableBalance = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var db = nano.use(db_name);
  	var id = this.client_id;
  	var me = this;


	//Get running balance
	var queryOptions = {key : parseInt(id)};
	db.view('client','running_balance', queryOptions, function(err, view) {
    	if (err) throw err;

    	//callback(view);
    	var running_balance = 0;
    	if (typeof view.rows[0] != "undefined"){
    		running_balance = view.rows[0].value;
    	}
    	me.running_balance_str = running_balance.toFixed(2).replace(/(\d)(?=(\d{3})+\.)/g, '$1,');
    	me.running_balance = parseFloat(running_balance);

    	willFulfillDeferred.resolve(running_balance);
  	});

   return willFulfill;
};

invoiceSchema.methods.getAvailableBalanceMongo = function()
{
    this.db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
    var avail_balance = this.db.model('AvailableBalance',availableBalanceSchema);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var clientId = this.client_id;
    var me = this;

    this.db.once('open', function () {

        var filter = {client_id:parseInt(clientId)};
        avail_balance.findOne(filter).lean().exec(function(err, avail_bal){


            if(err)
            {
                willFulfillDeferred.reject(err);
                me.db.close();
            }

            if(avail_bal)
            {
                me.available_balance = avail_bal.available_balance;
                willFulfillDeferred.resolve( me.available_balance);
            }
            else
            {
                me.available_balance = 0;
                willFulfillDeferred.resolve(me.available_balance);
            }

            me.db.close();


        });

    });
    return willFulfill;
};

invoiceSchema.methods.getClientActiveSubcons = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;

	mysql_connection.connect();

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var query = "SELECT s.id, s.userid, s.staff_email, s.job_designation, p.fname, p.lname FROM subcontractors s JOIN personal p ON p.userid = s.userid WHERE s.status IN ('ACTIVE', 'suspended') AND s.leads_id = ? ORDER BY p.fname, p.lname";
	mysql_connection.query(query, [id], function(err, rows) {
		if (err){
			willFulfillDeferred.reject(err);
		}
		me.active_subcons = rows;
		willFulfillDeferred.resolve(rows);
      	mysql_connection.end();
	});

	return willFulfill;
};

invoiceSchema.methods.syncDailyRates = function(){
	var db_value = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var db_currency = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");

	 function isDate(dateArg) {
	    var t = (dateArg instanceof Date) ? dateArg : (new Date(dateArg));
	    return !isNaN(t.valueOf());
	}

	function isValidRange(minDate, maxDate) {
	    return (new Date(minDate) <= new Date(maxDate));
	}

	function betweenDate(startDt, endDt) {
	    var error = ((isDate(endDt)) && (isDate(startDt)) && isValidRange(startDt, endDt)) ? false : true;
	    var between = [];
	    if (error) console.log('error occured!!!... Please Enter Valid Dates');
	    else {
	        var currentDate = new Date(startDt),
	            end = new Date(endDt);
	        while (currentDate <= end) {
	            between.push(new Date(currentDate));
	            currentDate.setDate(currentDate.getDate() + 1);
	        }
	    }
	    return between;
	}
	var ItemValue, Subcontractor, CurrencyAdjustmentValue;
	var currencyAdjustmentValueSchema = require("../models/CurrencyAdjustmentValue");
	try{
		ItemValue = db_value.model("ItemValue", itemValueSchema);
		Subcontractor = this.db.model("Subcontractor", subcontractorSchema);
		CurrencyAdjustmentValue = db_currency.model("CurrencyAdjustmentValue", currencyAdjustmentValueSchema);
	}catch(e){
		ItemValue = mongoose.model("ItemValue", itemValueSchema);
		Subcontractor = mongoose.model("Subcontractor", subcontractorSchema);
		CurrencyAdjustmentValue = mongoose.model("CurrencyAdjustmentValue", currencyAdjustmentValueSchema);
	}

	var me = this;
	var promises = [];
	var items = [];
	var currency_items = [];
	for(var i=0;i<this.items.length;i++){
		var item = this.items[i];
		if (typeof item.item_type != undefined && item.item_type == "Currency Adjustment"){
			if (item.start_date&&item.end_date){
				var between_dates = betweenDate(item.start_date, item.end_date);
				for(var j=0;j<between_dates.length;j++){
					var between_date = between_dates[j];
					var day_of_week = moment(between_date).weekday();
					if (day_of_week==0||day_of_week==6){
						continue;
					}
					if (typeof item.subcontractors_id != "undefined"){
						var month = moment(between_date).month()+1;
						var year = moment(between_date).year();
						var currencyValue = {};
						currencyValue.order_id = me.order_id;
						currencyValue.client_id = me.client_id;
						currencyValue.status = me.status;
						currencyValue.value = Number(item.unit_price);
						currencyValue.subcontractors_id = item.subcontractors_id;
						currencyValue.date = between_date;
						currencyValue.year = year;
						currencyValue.month = month;
						currencyValue.timestamp = parseInt(moment(between_date).format("X"));
						currency_items.push(currencyValue);
					}
				}

				CurrencyAdjustmentValue.find({order_id:me.order_id}).remove().exec(function(err, result){
					CurrencyAdjustmentValue.collection.insert(currency_items, function(err, result){
						db_currency.close();
					});
				});


			}
		}



		if (typeof item.item_type != undefined && item.item_type == "Regular Rostered Hours"){
			if (item.start_date&&item.end_date){
				var between_dates = betweenDate(item.start_date, item.end_date);
				for(var j=0;j<between_dates.length;j++){
					var between_date = between_dates[j];
					var day_of_week = moment(between_date).weekday();
					if (day_of_week==0||day_of_week==6){
						continue;
					}
					if (typeof item.subcontractors_id != "undefined"){

						function syncSubcon(between_date, item){
							var willFulfillDeferred = Q.defer();
							var willFulfill = willFulfillDeferred.promise;
							var month = moment(between_date).month()+1;
							var year = moment(between_date).year();
							setTimeout(function(){
								Subcontractor.findOne({subcontractors_id:parseInt(item.subcontractors_id)}).exec(function(err, subcon){
									if (typeof subcon == "undefined"){
										willFulfillDeferred.resolve(itemValue);
									}
									var itemValue = {};
									itemValue.order_id = me.order_id;
									itemValue.client_id = me.client_id;
									itemValue.status = me.status;
									itemValue.value = Number(subcon.getDailyRate());
									itemValue.subcontractors_id = item.subcontractors_id;
									itemValue.date = between_date;
									itemValue.year = year;
									itemValue.month = month;

									if (typeof item.item_id != "undefined"){
										itemValue.key = me.order_id+"-"+item.item_id;
									}else{
										itemValue.key = me.order_id+"-"+item.subcontractors_id;
									}
									itemValue.timestamp = parseInt(moment(between_date).format("X"));
									// console.log(itemValue);

									willFulfillDeferred.resolve(itemValue);
								});
							}, 100);
							return willFulfill;
						}


						var promise = syncSubcon(between_date, item);
						promises.push(promise);
						function delay(){ return Q.delay(100); }
						promises.push(delay);
						promise.then(function(itemValue){
							items.push(itemValue);
						});
					}

				}
			}
		}
	}

	//todo sync
	Q.allSettled(promises).then(function(response){
		console.log("All settled promises");
		console.log(items);
		ItemValue.find({order_id:me.order_id}).remove().exec(function(err, result){
			if (items.length!=0){
				ItemValue.collection.insert(items, function(err, result){
					db_value.close();
					if (err) {
						// TO DO: handle error
						console.log(err);
					} else {
						//console.info('%d item values were successfully stored.', result.length);
					}
				});
			}

		});

	});
};


invoiceSchema.methods.insertItemsInRunningBalance = function(){

	var UserComponent = require('../components/User');

	var db_value = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	//var runningBalanceSchema = require("../models/RunningBalance");
	var RunningBalance;
	try{
		RunningBalance = db_value.model("RunningBalance", runningBalanceSchema);
	}catch(e){
		RunningBalance = mongoose.model("RunningBalance", runningBalanceSchema);
	}

	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);

	var me = this;
	var promises = [];
	var items = [];

	//console.log(me.items);

	//Consider item_type . if it is existing in the list create document to reflect in client RBS.
	var selected_item_types = ["Bonus", "Placement Fee", "Buy Out", "Commissions", "Commission", "Reimbursement", "Gifts", "Office Fee", "Service Fee", "Training Room Fee", "Others"];

	if(me.client_basic_info.days_before_suspension == -30){
		selected_item_types.push("Currency Adjustment");
	}

	for(var i=0;i<this.items.length;i++){
		var item = this.items[i];
		if (typeof item.item_type != undefined){
			//console.log(item.item_type);
			if (selected_item_types.indexOf(item.item_type) >= 0) {
			    console.log("----Found " + item.item_type);

			    function newDoc(item){
					var willFulfillDeferred = Q.defer();
					var willFulfill = willFulfillDeferred.promise;

					setTimeout(function(){
						var amount = 0;
						var gst_amount = 0;
					    if(me.apply_gst == "Y"){
					    	gst_amount = item.amount * .10;
					    }

					    var amount = item.amount + gst_amount;



				    	var today = moment_tz().tz("GMT");
						var atz = today.clone().tz("Asia/Manila");
						var timestamp = atz.toDate();

						var itemValue = {};
						itemValue.client_id = me.client_id;
						itemValue.credit = parseFloat("0.00");
						itemValue.currency = me.currency;
						itemValue.credit_type = item.item_type;
						itemValue.charge = amount;
						itemValue.particular = item.description;
						itemValue.remarks = "Generated from paid invoice "+me.order_id;
						itemValue.type = "credit accounting";
						itemValue.added_by = me.by;
						itemValue.added_on = timestamp;
						willFulfillDeferred.resolve(itemValue);
					}, 100);


					return willFulfill;
				}


				var promise = newDoc(item);
				promises.push(promise);
				function delay(){ return Q.delay(100); }
				promises.push(delay);
				promise.then(function(itemValue){
					items.push(itemValue);
				});

			}
		}

	}



	Q.allSettled(promises).then(function(response){
		//console.log("All settled promises");
		//console.log(items);
		var user = new UserComponent(couch_db);


		function sleepFor( sleepDuration ){
 	 	    var now = new Date().getTime();
    		while(new Date().getTime() < now + sleepDuration){ /* do nothing */ }
		}

		for(var i=0; i<items.length; i++){
			var item = items[i];

			//Get client current available running balance
			user.getClientRunningBalance(item, callback);

			function callback(item){

		   		var doc = item;
		   		var mongo_doc = new RunningBalance(item);

		    	mongo_doc.save(function(err){
					if (err) {
						console.log(err);
					}
					//console.info("saved in mongodb");

					//Insert new document in Couchdb
				  	doc.charge = ""+doc.charge;
				  	doc.credit = ""+doc.credit;
				  	doc.running_balance = ""+doc.running_balance;
				  	doc.added_on =  [moment(doc.added_on).year(), moment(doc.added_on).month()+1, moment(doc.added_on).date(), moment(doc.added_on).hour(), moment(doc.added_on).minute(), moment(doc.added_on).second()] ;
				  	couch_db.insert(doc, function(err, body){
						console.info("saved in couchdb");
						mongo_doc.couch_id = body.id;
						mongo_doc.save(function(err){
							//db.close();
							//console.info("updated in mongodb");
						});
					});

				});


			}

			sleepFor(2000);
		}

	});

};



invoiceSchema.methods.syncVersion = function(){
	var invoiceVersionSchema = require("../models/InvoiceVersion");
	var db_version = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var InvoiceVersion = db_version.model("InvoiceVersion", invoiceVersionSchema);
	var me = this;
	db_version.on("open", ()=>{
		InvoiceVersion.findOne({order_id:me.order_id}).sort({version_number:-1}).exec(function(err, result_invoice_version){
			var version_number = 1;
			//console.log(result_invoice_version);
			if (result_invoice_version!=null){
				version_number = result_invoice_version.version_number + 1;
			}
			var invoice_version = new InvoiceVersion(me);
			invoice_version._id = null;
			invoice_version.version_number = version_number;
			invoice_version.date_synced = new Date();
			invoice_version.save(function(err){
				db_version.close();
			});
		});
	});

};


//get ready for release notes

invoiceSchema.methods.getReadyForReleaseNotes = function()
{

	this.db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
	var readyForReleaseNotes = this.db.model('Notes',ReadyForReleaseSchema);

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var order_id = this.order_id;
	var me = this;


	try {

		this.db.once("open",function(){

			readyForReleaseNotes.find({order_id:order_id}).exec(function(err,doc){

				if(err)
				{
					willFulfillDeferred.reject(err);

				}

				me.db.close();
				me.ready_for_releasae_notes = doc;
				willFulfillDeferred.resolve(me);

			});

		});

	}catch(e)
	{
		console.log(e);
		willFulfillDeferred.reject(err);
	}


	return willFulfill;

}

//for data summary reporting
invoiceSchema.methods.getDataSummaryView = function(i)
{
    var temp = {};
    var client = this;
    var basic_info = this.client_basic_info;
    var available_balance = this.available_balance;
    var remarks = this.remarks;


    temp.client_fname = client.client_fname;
    temp.client_lname = client.client_lname;
    temp.days_before_suspension = basic_info.days_before_suspension;
    temp.order_id = client.order_id;
	temp.payment_receipt = "OR-"+client.order_id;
    temp.client_id = client.client_id;
    temp.apply_gst = client.apply_gst;
    temp.total_amount = client.total_amount;
    temp.order_date = client.added_on;
    temp.due_date = client.pay_before_date;
    temp.last_date_update = client.last_date_updated;
    temp.payment_advice = client.payment_advise;
    temp.status = client.status;
    temp.available_balance = available_balance;
    temp.currency = client.currency;
    temp.comments = client.comments;
    temp._id = client._id;
    temp.items = client.items[0];//just for getting the start_date and end_date
    temp.items_all = client.items;//just for getting the start_date and end_date
    temp.index = i;
    temp.date_paid = client.date_paid_date;
    temp.active = (basic_info.isActive ? "yes_client" : "not_client");
    temp.couch_id = client.couch_id;
    temp.history = client.history;
	temp.ready_for_release_notes = (client.ready_for_releasae_notes ? client.ready_for_releasae_notes : []);
    // temp.remarks = remarks;

    return temp;
};


module.exports = invoiceSchema;