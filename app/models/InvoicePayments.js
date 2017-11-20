var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
	couch_id : {type:String},
    added_on : Date,
    transaction_id : {type:String},
    transaction_doc : Array,        
    client_id : {type:Number},
    payment_mode : {type:String},
    order_id : {type:String},
	invoice_date : Date,
    pay_before_date : Date,
    input_amount : {type:String},
    total_amount : {type:String},
    currency : {type:String},
    payment_date : Date,
    days_before_suspension : {type:Number},
    billing_type : {type:String},
    remarks : {type:String},         
    set_paid_by: {type:String},        
    admin_id : {type:Number},
	admin_name : String,
    response  : Array,
    doc_order : Array,
    over_payment : Boolean,
	sent_last_date : Date,
	receipt_number : String,
	overpayment_from : String,
	overpayment_from_doc_id : String
};


var invoicePaymentsSchema = new Schema(fields,
{collection:"invoice_payments"});

invoicePaymentsSchema.methods.getInvoice = function(){
	//console.log(this.client);
	var temp = this;
	var client_basic_info = this.client_basic_info;
	var running_balance = this.running_balance;
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

invoicePaymentsSchema.methods.createHTMLInvoice = function(doc){
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
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-receipt-attachment.html');
	var output = template({
		doc : doc
	});

	var path = '/home/remotestaff/tmp/';
	//Create html file
	var html_filename = "payment-receipt-"+me.order_id+".html";	
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

invoicePaymentsSchema.methods.convertHTML2PDF = function(html_file){

	var fs = require('fs');
	var pdf = require('html-pdf');

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var path = '/home/remotestaff/tmp/';
	//Create pdf file
	var pdf_filename = "invoice-"+me.order_id+".pdf";	
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

invoicePaymentsSchema.methods.createHTML2PDF = function(){
	var swig  = require('swig');
	var fs = require('fs');
	var pdf = require('html-pdf');
	

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	console.log("fname : " + me.client_basic_info.fname);
	console.log("lname : " + me.client_basic_info.lname);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var today = atz.toDate();
  	var today = moment(today).year()+"_"+(moment(today).month()+1)+"_"+moment(today).date()+"_"+moment(today).hour()+"_"+moment(today).minute()+"_"+moment(today).second();


    //Crete template
	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/invoice/invoice-receipt-attachment.html');
	var output = template({
		doc : me
	});

	
	var path = '/home/remotestaff/tmp/'; 
	
	//html file
	var html_filename = "payment-receipt-"+me.order_id+".html";	
	var html_file = path+""+html_filename;
	
	//pdf file
	var pdf_filename = "payment-receipt-"+me.order_id+".pdf";		
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

invoicePaymentsSchema.methods.attachPDF = function(couch_id, pdf_file){
	var fs = require('fs');
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

  	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var pdf_filename = "payment-receipt-"+me.order_id+".pdf";

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

invoicePaymentsSchema.methods.updateMailboxDoc = function(couch_id){

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

invoicePaymentsSchema.methods.sendMailbox = function(mailbox_doc){
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

invoicePaymentsSchema.methods.getCouchdbAvailableBalance = function(){
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
    	me.running_balance = parseFloat(running_balance);
    	willFulfillDeferred.resolve(running_balance);
  	});
  	
   return willFulfill;
};


invoicePaymentsSchema.methods.getClientBasicInfo = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;
	
	mysql_connection.connect();
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT l.fname, l.lname  FROM leads l WHERE l.id = ?";
	
	mysql_connection.query(query, [id], function(err, client_basic_info) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
				
		me.client_basic_info = client_basic_info[0];
		willFulfillDeferred.resolve(client_basic_info[0]);
      	mysql_connection.end();
	});
	
	return willFulfill;
};


invoicePaymentsSchema.methods.getClientInvoiceEmailSettings = function(){
	
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
						
						var unique_emails=[];	
						if(typeof row[0].email != "undefined"){
							unique_emails.push({email : row[0].email, client_recipient : true});	
						}
						
						if(typeof row[0].admin_email != "undefined"){
							unique_emails.push({email : row[0].admin_email, client_recipient : false});	
						}					
												
						unique_emails.push({email : "accounts@remotestaff.com.au", client_recipient : false});												
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



module.exports = invoicePaymentsSchema;