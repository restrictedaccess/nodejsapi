var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');
var invoiceSchema = require("../models/Invoice");
var subcontractorSchema = require("../models/Subcontractor");
var notesSchema = require("../models/Notes");
var agentInfoSchema = require("../mysql/Agent_Info");

var mongoCredentials = configs.getMongoCredentials();

var clientSchema = new Schema({
	client_id:Number,
	lead:{
		fname:String,
		lname:String,
		email:String,
		status:String,
		timestamp:String,
		csro_id:Number
	},
	currency:String,
	apply_gst:String,
	client_doc:{
        client_id:Number,
		days_before_suspension:Number,
		autodebit:String,
		days_before_invoice:Number,
		days_to_invoice:Number,
		send_invoice_reminder:String
	}
}, {
	collection:"client_settings"
});



clientSchema.methods.getClientAssignedSC = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;
	var csro_id = this.lead.csro_id;
	console.log("csro_id : " + csro_id);
	mysql_connection.connect();	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT admin_fname, admin_lname, admin_email FROM admin WHERE admin_id = ?";
	
	mysql_connection.query(query, [csro_id], function(err, admin) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
		console.log(admin[0]);
		me.staffing_consultant = admin[0];
		willFulfillDeferred.resolve(admin[0]);
		
      	mysql_connection.end();
	});
	
	return willFulfill;
};

clientSchema.methods.getInvoices = function(status, lean){
	
	if (typeof status == "undefined"){
		status = "all";
	}
	if (typeof lean == "undefined"){
		lean = true;
	}
	var Invoice;
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	
	var filter = {client_id:this.client_id};
	if (status!="all"){
		filter.status = status;
	}


	var db;

	if (this.db==null||typeof this.db == "undefined"){
		db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		//console.log("Get Invoices "+this.client_id);
		Invoice = db.model("Invoice", invoiceSchema);
		

		db.once("open", function(){
			if (lean){
				Invoice.find(filter).sort({added_on:-1}).lean().exec(function(err, invoices){
					if (err){
						throw err;
					}
					var result = {
						invoices:invoices,
						client:me
					};
					me.invoices = invoices;
					db.close();
					willFulfillDeferred.resolve(result);
				});
			}else{
				Invoice.find(filter).sort({added_on:-1}).exec(function(err, invoices){
					//console.log(err);
					if (err){
						throw err;
					}
					var result = {
						invoices:invoices,
						client:me
					};
					me.invoices = invoices;
					db.close();
					willFulfillDeferred.resolve(result);
				});		
			}
		});
	

	}else{
		db = this.db;
		//console.log("Get Invoices "+this.client_id);
		Invoice = db.model("Invoice", invoiceSchema);
		if (lean){
			Invoice.find(filter).sort({added_on:-1}).lean().exec(function(err, invoices){
				if (err){
					throw err;
				}
				var result = {
					invoices:invoices,
					client:me
				};
				me.invoices = invoices;
				//db.close();
				willFulfillDeferred.resolve(result);
			});
		}else{
			Invoice.find(filter).sort({added_on:-1}).exec(function(err, invoices){
				//console.log(err);
				if (err){
					throw err;
				}
				var result = {
					invoices:invoices,
					client:me
				};
				me.invoices = invoices;
				//db.close();
				willFulfillDeferred.resolve(result);
			});		
		}
	}
	return willFulfill;
};

clientSchema.methods.getNewTaxInvoiceNo = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Invoice = db.model("Invoice", invoiceSchema);
	
	var filter = {client_id:this.client_id};
	var me = this;

	db.once("open", function(){
		Invoice.findOne(filter).sort({added_on:-1}).exec(function(err, invoice){
			if (err){
				console.log(err);
				db.close();
				willFulfillDeferred.resolve(false);
			}
			var last_order_id;
			if (invoice!=null){
				last_order_id = parseInt(invoice.order_id.split("-")[1]);
			}else{
				last_order_id = 0;
			}
			
			function pad(n, width, z) {
			z = z || '0';
			n = n + '';
			return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
			}
			
			db.close();
			willFulfillDeferred.resolve(me.client_id+"-"+pad(last_order_id+1, 8));
		});
	});
	return willFulfill;
};

clientSchema.methods.getMongoActiveSubcons = function(){
	var Subcontractor;
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var db;		
	var me = this;

	var filter = {"leads_detail.id":parseInt(this.client_id), "subcontractors_detail.status":{$in:["ACTIVE", "suspended"]}};
	
	if (this.db==null||typeof this.db == "undefined"){
		db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		Subcontractor = db.model("Subcontractor", subcontractorSchema);
		
		
		db.once("open", function(){

			console.log("Mongo Active Subcons "+me.client_id);
			Subcontractor.find(filter).exec(function(err, subcontractors){

				if (err){
					throw err;
				}

				me.subcontractors = subcontractors;
				var promises = [];
				for(var i=0;i<me.subcontractors.length;i++){
					var subcon = me.subcontractors[i];
					var promise_subcon = subcon.getCurrencyAdjustment();
					promises.push(promise_subcon);
				}
				Q.all(promises).then(function(result){
					db.close();
					willFulfillDeferred.resolve(me.subcontractors);
				});

			});
		});
	}else{
		db = this.db;
		Subcontractor = db.model("Subcontractor", subcontractorSchema);
		Subcontractor.find(filter).exec(function(err, subcontractors){
			if (err){
				throw err;
			}
			try{

				me.subcontractors = subcontractors;
				if (subcontractors.length < 1){
					var promises = [];
					for(var i=0;i<me.subcontractors.length;i++){
						var subcon = me.subcontractors[i];
						subcon.db = db;
						var promise_subcon = subcon.getCurrencyAdjustment();
						promises.push(promise_subcon);
					}
					
					Q.all(promises).then(function(result){
						//db.close();
						willFulfillDeferred.resolve(me.subcontractors);
					});
				}else{
					willFulfillDeferred.resolve(false);	
				}

			}catch(e){
				console.log(e.message);
				willFulfillDeferred.resolve(false);
			}


		});
	}

	return willFulfill;
};

clientSchema.methods.getClientAccountNotes = function(){
	/*
	var ClientNotes = mongoose.model("ClientNotes", clientNotesSchema);
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	
	var filter = { "client_id" : parseFloat(this.client_id)};
	console.log(filter);
	ClientNotes.find(filter).exec(function(err, client_account_notes){
		console.log(client_account_notes);
		me.client_account_notes = client_account_notes;
		willFulfillDeferred.resolve(client_account_notes);
	});
	return willFulfill;
	*/
	
	
	var Notes = mongoose.model("Notes", notesSchema);
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;
	
	var filter = {"client_id":parseInt(this.client_id)};
	Notes.find(filter).exec(function(err, notes){
		me.notes = notes;
		willFulfillDeferred.resolve(notes);
	});
	return willFulfill;
};

clientSchema.methods.getClientDailyRate = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;
	
	mysql_connection.connect();
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT s.id, s.client_price, s.work_status, s.status FROM subcontractors s WHERE s.status IN ('ACTIVE', 'suspended') AND s.leads_id = ?";
	var daily_rate = 0.0;
	var staff_daily_rate = 0.0;
	var total_active_subcons = 0;
	var suspended_subcons = 0;
	mysql_connection.query(query, [id], function(err, subcontractors) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
		

		for(var j=0;j<subcontractors.length;j++){
			subcon = subcontractors[j];
			staff_daily_rate = parseFloat(subcon.client_price) * 12.0 / 52.0 / 5.0;			
			daily_rate = daily_rate + staff_daily_rate;
			//console.log(subcon.client_price);
			
			if(subcon.status == "suspended"){
				suspended_subcons = suspended_subcons + 1;
			}			  
		}
		
		me.daily_rate = {daily_rate : daily_rate, total_active_subcons : subcontractors.length, suspended_subcons : suspended_subcons };
		willFulfillDeferred.resolve(daily_rate);
      	mysql_connection.end();
	});
	
	return willFulfill;
};

clientSchema.methods.getInvoiceCreationView = function(){
	//console.log(item.client_id);
	var temp = {};
	var client = this;
	var invoices = this.invoices;
	var invoice_list = [];
	var they_owe_us = 0;
	
	for(var j=0;j<invoices.length;j++){
		invoice = invoices[j];
		doc = invoice.getBasic();
		//console.log(doc.total_amount);
		they_owe_us = they_owe_us + parseFloat(doc.total_amount); 
		invoice_list.push(doc);  
	}
	//console.log(invoice_list);
	
	temp.client_id = client.client_id;
	temp.fname = client.lead.fname;
	temp.lname = client.lead.lname;
	temp.email = client.lead.email;
	temp.currency = client.currency;
	temp.they_owe_us = they_owe_us;
	temp.awaiting_invoices = invoice_list;

	
	if (typeof client.apply_gst != "undefined"){
		temp.apply_gst = client.apply_gst;
	}else{
		temp.apply_gst = "N";
	}
	
	var active_subcons = [];
	for (var i=0;i<this.subcontractors.length;i++){
		active_subcons.push(this.subcontractors[i].getBasic());
	}
	temp.active_subcons = active_subcons;
	
	return temp;
};

clientSchema.methods.getAllClientInvoice = function(){
	//console.log(this.notes);
	
	var temp = {};
	var client = this;
	var invoices = this.invoices;
	var invoice_list = [];
	var they_owe_us = 0;
	var awaiting_invoices = [];
	var running_balance = this.running_balance;
	var total_paid_payment=0;
	var daily_rate = this.daily_rate;
	var staffing_consultant = this.staffing_consultant;
	//console.log(client_account_notes);
	
	for(var j=0;j<invoices.length;j++){
		invoice = invoices[j];
		doc = invoice.getBasic();	
		
		if(doc.status == "new"){
			they_owe_us = they_owe_us + parseFloat(doc.total_amount);	
			awaiting_invoices.push(doc);
		} 	
		
		if(doc.status == "paid"){
			total_paid_payment = total_paid_payment + parseFloat(doc.total_amount);	
		//	paid_invoice_list.push(doc);
		}
		 
		invoice_list.push(doc);  
	}
	temp.client_id = client.client_id;
	temp.fname = client.lead.fname;
	temp.lname = client.lead.lname;
	temp.email = client.lead.email;
	temp.currency = client.currency;
	
	if (typeof client.apply_gst != "undefined"){
		temp.apply_gst = client.apply_gst;
	}
	
	if (typeof client.client_doc.autodebit != "undefined"){
		temp.autodebit = client.client_doc.autodebit;
	}
	
			        	
	if (typeof client.client_doc.days_before_invoice != "undefined"){
		temp.days_before_invoice = client.client_doc.days_before_invoice;
	}
	if (typeof client.client_doc.days_before_suspension != "undefined"){
		temp.days_before_suspension = client.client_doc.days_before_suspension;
	}
	if (typeof client.client_doc.days_to_invoice != "undefined"){
		temp.days_to_invoice = client.client_doc.days_to_invoice;
	}
	if (typeof client.client_doc.send_invoice_reminder != "undefined"){
		temp.send_invoice_reminder = client.client_doc.send_invoice_reminder;
	}
	
	
	temp.they_owe_us = they_owe_us;
	temp.awaiting_invoices = awaiting_invoices;
	temp.invoice_list = invoice_list;
	temp.running_balance = running_balance;
	temp.total_paid_payment = total_paid_payment;
	temp.daily_rate = daily_rate;
	temp.lead = client.lead;
	temp.staffing_consultant = staffing_consultant;
	return temp;
};


clientSchema.methods.getClient = function(){
	//console.log(this.notes);
	
	var temp = {};
	var client = this;
	var invoices = this.invoices;
	//var invoice_list = [];
	var they_owe_us = 0;
	//var awaiting_invoices = [];
	var running_balance = this.running_balance;
	var total_paid_payment=0;
	var daily_rate = this.daily_rate;
	//var notes = this.notes;
	//console.log(client_account_notes);
	
	for(var j=0;j<invoices.length;j++){
		invoice = invoices[j];
		doc = invoice.getBasic();	
		
		if(doc.status == "new"){
			they_owe_us = they_owe_us + parseFloat(doc.total_amount);	
		} 	  
	}
	temp.client_id = client.client_id;
	temp.fname = client.lead.fname;
	temp.lname = client.lead.lname;
	temp.email = client.lead.email;
	temp.currency = client.currency;
	
	if (typeof client.apply_gst != "undefined"){
		temp.apply_gst = client.apply_gst;
	}

	if (typeof client.client_doc.days_before_suspension != "undefined"){
		temp.days_before_suspension = client.client_doc.days_before_suspension;
	}

	
	
	temp.they_owe_us = they_owe_us;
	temp.running_balance = running_balance;
	temp.daily_rate = daily_rate;
	//temp.notes = notes;
	return temp;
};



clientSchema.methods.getActiveSubcons = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	
	mysql_connection.connect();
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT s.id, s.userid, s.staff_email, p.fname, p.lname FROM subcontractors s JOIN personal p ON p.userid = s.userid WHERE s.status IN ('ACTIVE', 'suspended') AND s.leads_id = ? ORDER BY p.fname, p.lname";
	mysql_connection.query(query, [id], function(err, rows) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
		
		willFulfillDeferred.resolve(rows);
      	mysql_connection.end();
	});
	
	return willFulfill;
};

clientSchema.methods.getCouchdbAvailableBalance = function(){
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var db = nano.use(db_name);
  	var id = this.client_id;
  	var me = this;

  	//Searching by  _id
  	//db.get('384aee8472e85b0e4300d7885541e7a5', function(err, body) {
	//	if (err) throw err;
	//    callback(body);
	//});
	
	//Search by design views
	
	/*
	//Search by order_id
	var order_id = "10000-00000001";
  	var queryOptions = {key : order_id};	
	db.view('orders','get_order_id', queryOptions, function(err, view) {
    	if (err) throw err;
    	var row = view.rows[0];
		
	    
	    //Client Invoice details
	    db.get(row.id, function(error, body) {
			if (error) throw error;
		    callback(body);
	    });
  	});
	*/
	
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


clientSchema.methods.getClientBasicInfo = function(){
	var mysql_connection = configs.getMysql();
	var id = this.client_id;
	var me = this;
	
	mysql_connection.connect();
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT id, fname, lname, email, company_name, company_address, officenumber, mobile, leads_skype_id FROM leads  WHERE id = ?";
	
	mysql_connection.query(query, [id], function(err, client_basic_info) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
				
		me.client_basic_info = client_basic_info;
		willFulfillDeferred.resolve(client_basic_info);
      	mysql_connection.end();
	});
	
	return willFulfill;
};


clientSchema.methods.syncCredentialsToAgent = function(){

	var deferred_promise = Q.defer();
	var promise = deferred_promise.promise;
	var userCredentialsSchema = require("../models/UserCredential");
	var me = this;

	var db = me.db;

	UserCredential = db.model("UserCredential", userCredentialsSchema);


	me.getMongoActiveSubcons().then(function(subcontractors){

		if(subcontractors.length > 0){
				UserCredential.findOne({"email":me.lead.email}).exec(function (err, currentCredential){
					if(currentCredential){


						var newAgentParams = {
							fname: me.lead.fname,
							lname: me.lead.lname,
							email: me.lead.email,
							timestamp: me.lead.timestamp,
							password: "",
							work_status: "AFF",
							status: "ACTIVE",
							leads_id: me.client_id
						};
						for(var i = 0;i < currentCredential.credentials.length;i++){
							var item = currentCredential.credentials[i];
							if(item.user_type == "leads"){
								newAgentParams.password = item.password;
							}
						}
						agentInfoSchema.count(
							{
								where: ["email = ?", newAgentParams.email]
							}
						).then(function(numCount){
							if(numCount <= 0){
								agentInfoSchema.insertAgent(newAgentParams).then(function(newAgentData){
									deferred_promise.resolve(newAgentData);

								});
							} else{

								deferred_promise.resolve(null);
							}
						});

					} else{
						deferred_promise.resolve(null);
					}

				});
		} else{
			deferred_promise.resolve(null);
		}
	});
	return promise;


};
module.exports = clientSchema;