var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
http.post = require("http-post");
var njsUrl = "http://127.0.0.1:3000";

//import ClientsSchema
var clientSchema = require("../models/Client");
var clientsQueue = require("../bull/clients_queue");


var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

/*
 * Method in getting new tax invoice number
 * @url http://test.njs.remotestaff.com.au/clients/get-new-tax-invoice-no/
 * @param int id 
 */
router.all("/get-new-tax-invoice-no", function(req,res,next){
	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var Client = db.model("Client", clientSchema);
	
	var search_key = {};
	if(req.body.id){
		var id = parseInt(req.body.id);
		search_key={client_id:id};
	}else{
		var result = {success:false};
		return res.send(result, 200);
	}
	
	db.once('open', function(){
		Client.findOne(search_key).exec(function(err, client){
			client.db = db;
			client.getNewTaxInvoiceNo().then(function(invoice_no){
				var result = {success:true, tax_invoice_no:invoice_no};
				db.close();
				return res.send(result, 200);
			});
		});
	});
});

/*
 * Method in getting all client's
 * @url http://test.njs.remotestaff.com.au/clients/get-all-clients/
 * @param int id 
 */
router.all("/get-all-clients", function(req,res,next){
	var search_key = {};
	if(req.query.id){
		var id = parseInt(req.query.id);
		search_key={client_id:id};
	}


	function getAllCandidates(page){
		var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
		var Client = db.model("Client", clientSchema);
		var deferredPromiseCandidates = Q.defer();
		var deferredPromiseCandidatesPromise = deferredPromiseCandidates.promise;
		var clients=[];
		var promises = [];

		var clientInvoiceCreationSchema = require("../models/ClientInvoiceCreation");
		var ClientInvoiceCreationModel = db.model("ClientInvoiceCreation", clientInvoiceCreationSchema);

		
		db.once('open', function(){
			if (typeof page=="undefined"){
				page = 1;
			}


			var clients = [];
			var skips = (page-1) * 300;

			ClientInvoiceCreationModel.find(search_key)
				.skip(skips)
				.limit(300)
				.lean()
				.sort({ 'fname' : 'asc', 'lname' : 'asc'}).exec(function(err, docs){
				if (!err){
					for(var i = 0;i < docs.length;i++){
						clients.push(docs[i]);
					}
					deferredPromiseCandidates.resolve(clients);
				}
			});

            //
			// Client.find(search_key)
			// 	.skip(skips)
			// 	.limit(300)
			// 	.sort({ 'lead.fname' : 'asc', 'lead.lname' : 'asc'}).exec(function(err, docs){
			// 		//console.log(docs);
			// 		if (!err){
			// 			for(var i=0;i<docs.length;i++){
			// 			//initialise empty object
			//
			// 			function client_output(){
			//
			// 			}
			//
			// 			var temp = new client_output();
			// 			item = docs[i];
			//
			// 			var per_client_promises = [];
			// 			function delay(){ return Q.delay(100); }
			// 			item.db = db;
			//
			// 			//set promise per client to do multi tasking
			// 			var promise_invoice = item.getInvoices("new", false);
			// 			var promise_subcons = item.getMongoActiveSubcons();
			//
			// 			per_client_promises.push(promise_invoice);
			// 			//per_client_promises.push(delay);
			// 			per_client_promises.push(promise_subcons);
			// 			//per_client_promises.push(delay);
			//
			//
			// 			per_client_promises_promise = Q.all(per_client_promises);
			// 			per_client_promises_promise.then(function(result){
			// 				//console.log(result);
			// 				return true;
			// 			});
			// 			promises.push(per_client_promises_promise);
			// 			//promises.push(delay);
			//
			// 		}
			// 	}
            //
			// 	var allPromise = Q.all(promises);
			// 	allPromise.then(function(results){
			// 		console.log("All promises done noww!!!!!");
			// 		//console.log(docs);
			// 		try{
			// 			for(var i=0;i<docs.length;i++){
			// 				clients.push(docs[i].getInvoiceCreationView());
			// 			}
			// 			db.close();
			// 			deferredPromiseCandidates.resolve(clients);
			// 		}catch(e){
			// 			db.close();
			// 			deferredPromiseCandidates.resolve(e.message);
			// 		}
            //
			// 	});
			// });

		});

		return deferredPromiseCandidatesPromise;
	}
		
	var allClients = [];
	var deferredPromise = Q.defer();
	var promise = deferredPromise.promise;

	function recursiveClientsGet(page){
		console.log(page);
		getAllCandidates(page).then(function(clients){
			if (clients.length==0){
				deferredPromise.resolve(true);
			}else{
				//console.log(clients);
				for(var i=0;i<clients.length;i++){
					allClients.push(clients[i]);
				}
				recursiveClientsGet(page+1);
			}

		});
	}

	promise.then(()=>{
		return res.status(200).send({success:true, clients:allClients, total_docs:allClients.length}); 
	});
	
	recursiveClientsGet(1);



});


/*
 * Method in showing client's currency setting
 * @url http://test.njs.remotestaff.com.au/clients/get-client-settings/?id=11
 * @param int id 
 */
router.get("/get-client-settings", function(req,res,next){
	var Client = mongoose.model("Client", clientSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	
	db.once('open', function(){
		try
		{
			Client.findOne({client_id:id}).exec(function(err, client){
				if(client)
				{

					client.getInvoices().then(function(invoices){
						var result = {
							success:true,
							result : {
								fname : client.lead.fname,
								lname : client.lead.lname,
								email : client.lead.email,
								currency : client.currency,
								apply_gst : client.apply_gst,
								days_before_suspension : client.client_doc.days_before_suspension,
								invoices:invoices
							}
						};

						db.close();
						return res.send(result, 200);
					}).catch(function(err){
						db.close();
					});

				}else
				{
					var result = {
						success:false,
						msg: "null"
					};

					db.close();
					return res.send(result, 200);
				}

			});
		}
		catch(e)
		{
			db.close();
		}

	});
});


/*
 * Method in getting client's invoices
 * @url http://test.njs.remotestaff.com.au/clients/get-client-invoices/?id=11
 * @param int id 
 */
router.get("/get-client-invoices", function(req,res,next){
	var Client = mongoose.model("Client", clientSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	db.once('open', function(){
		Client.findOne({client_id:id}).exec(function(err, client){			
		
			client.getInvoices(renderInvoices);
			function renderInvoices(err, invoices){				
				db.close();				
				var result = {success:true, invoices : invoices};
				//console.log(invoices);
				return res.send(result, 200);	
			}

			
		});
	});
});

/*
 * Method in getting client's active subcons
 * @url http://test.njs.remotestaff.com.au/clients/get-client-active-subcons/?id=11
 * @param int id
 */
router.get("/get-client-active-subcons", function(req,res,next){
	var Client = mongoose.model("Client", clientSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	db.once('open', function(){
		Client.findOne({client_id:id}).exec(function(err, client){			
			db.close();			
			client.getActiveSubcons().then(function(rows){
				var result = {
					success:true, 
					result : {
						subcons : rows,
						total : rows.length		
					}
				};	
					
				return res.send(result, 200);
			}).catch(function(err){
				var result = {
					success:false,
					error:"Something went wrong in getting the active subcons" 
				};
				
			});
			
		});
	});
});


/*
 * Method in getting client's active subcons
 * @url http://test.njs.remotestaff.com.au/clients/get-client-couch-available-balance/?id=11
 * @param int id
 */
router.get("/get-client-couch-available-balance", function(req,res,next){
	var Client = mongoose.model("Client", clientSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	db.once('open', function(){
		Client.findOne({client_id:id}).exec(function(err, client){			
			db.close();			
			client.getCouchdbAvailableBalance(renderResult);
			function renderResult(data){
				console.log(data);
				running_balance = "0.00";
				if (typeof data.rows[0] != "undefined"){
		    		running_balance = data.rows[0].value; 
		    	}
    	
				var result = {
					success:true, 
					result : running_balance
				};
				return res.send(result, 200);
			}
			
		});
	});
});

/*
 * Method to sync client/subcon information to client_invoice_creation collection in mongo
 * @url /clients/sync-client-invoice-creation/?id=11
 * @param int id
 */
router.get("/sync-client-invoice-creation", function(req,res,next){
	if(!req.query.id){
		return res.status(200).send({success:false, error: "id is required!"});
	}



	var client = {
		id: parseInt(req.query.id),
	};


	clientsQueue.add({processClient:client});

	res.status(200).send({success:true, result: req.query});
});


/*
 * Method to sync client/subcon information to client_invoice_creation collection in mongo
 * @url /clients/sync-client-invoice-creation-many/?limit=100
 * @param int id
 */
router.get("/sync-client-invoice-creation-many", function(req,res,next){
	var limit = null;
	if(req.query.limit){
		limit = parseInt(req.query.limit);
	}


	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
	var Client = db.model("Client", clientSchema);
	db.once('open', function() {


		var clients = [];
		var clients_find = Client.find();
		clients_find.select({ "client_id": 1});

		if(limit){
			var page = 1;
			var skips = (page - 1) * limit;
			clients_find.skip(skips);
			clients_find.limit(limit);
		}

		function syncToMongo(id){
			var defer = Q.defer();

			var callback = function(response) {
				var str = '';

				//another chunk of data has been recieved, so append it to `str`
				response.on('data', function (chunk) {
					str += chunk;
				});

				//the whole response has been recieved, so we just print it out here
				response.on('end', function () {
					defer.resolve({success:true});
				});
			};


			http.get(njsUrl + '/clients/sync-client-invoice-creation/?id=' + id, callback);

			return defer.promise;
		}

		clients_find.exec(function(err, docs) {
			if (!err) {
				var all_sync_promises = [];
				console.log("starting to sync all limit: " + limit);
				for(var i = 0;i < docs.length;i++){
					all_sync_promises.push(syncToMongo(docs[i]["client_id"]));
				}


				Q.allSettled(all_sync_promises).then(function(results){
					console.log("Done creating sync jobs for all");
					res.status(200).send({success:true, result: docs, counter: docs.length});
				});
			} else{

				res.status(200).send({success:false, error: err});
			}

			db.close();
		});

	});



});




/*
 * Metho to fetch abn number of a client
 * @url /clients/get-client-abn-number/?client_id=11
 * @param int id
 */
router.get("/get-client-abn-number", function(req,res,next){
	var leads_info_schema = require("../mysql/Lead_Info");

	if(!req.query.client_id){
        return res.status(200).send({success:false, error: ["client_id is required!"]});
	}

    leads_info_schema.getClientInfo(req.query.client_id).then(function(fetchedClientInfo){
    	if(fetchedClientInfo[0] && fetchedClientInfo[0].abn_number != "" && fetchedClientInfo[0].abn_number){
            return res.status(200).send({success:true, result: fetchedClientInfo[0].abn_number});
		} else{
            return res.status(200).send({success:false, error: ["abn_number is not set"]});
		}

	});

});

module.exports = router;