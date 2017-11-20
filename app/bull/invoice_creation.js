var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../config/configs");
var numWorkers = 4;
var invoiceCreationQueue = Queue('invoiceCreation', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();
var http = require("http");
var invoiceSchema = require("../models/Invoice");
invoiceCreationQueue.process(function(job, done){
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


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	
    var search_key={client_id:parseInt(job.data.client_id)};
    var Invoice = db.model("Invoice", invoiceSchema);
	

    db.once("open", function(){
        Client.findOne(search_key).exec(function(err, client){
            client.db = db;
            client.getNewTaxInvoiceNo().then(function(invoice_no){
                
                var today = moment_tz().tz("GMT");
                var atz = today.clone().tz("Asia/Manila");
                var timestamp = atz.toDate();


                var startOfTheMonth = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1);
                var endOfTheMonth = new Date(timestamp.getFullYear(), timestamp.getMonth()+1, 0);
                var previousMonth = new Date(timestamp.getFullYear(), timestamp.getMonth()-1, 1);
                

                //invoice items collection
                var invoice_items = [];

                function getAdjustmentItems(client, date){
                    var deferred_promise = Q.defer();
                    var promise = deferred_promise.promise;
					http.get("http://127.0.0.1:3000"+"/timesheet/invoice-items/?client_id="+client_id+"&month_year="+moment(date).format("YYYY-MM-DD"), (res) => {
						res.setEncoding('utf-8')

						var body = '';

						res.on('data', function(chunk){
							body += chunk;
						});

						res.on("end", function(){
							data = JSON.parse(body);
                            if (data.success){
                                deferred_promise.resolve(data.result);
                            }else{
                                deferred_promise.resolve([]);
                            }
						});
					});
                    return promise;
                }

                function getCurrencyAdjustmentItems(client, date){
                    var deferred_promise = Q.defer();
                    var promise = deferred_promise.promise;
					http.get("http://127.0.0.1:3000"+"/timesheet/currency-adjustments/?client_id="+client_id+"&month_year="+moment(date).format("YYYY-MM-DD"), (res) => {
						res.setEncoding('utf-8')

						var body = '';

						res.on('data', function(chunk){
							body += chunk;
						});

						res.on("end", function(){
							data = JSON.parse(body);
                            if (data.success){
                                deferred_promise.resolve(data.result);
                            }else{
                                deferred_promise.resolve([]);
                            }
						});
					});
                    return promise;
                }

                var promiseAdjustmentItems = getAdjustmentItems(client,startOfTheMonth);
                function populateListAdjItems(items){
                    for (var i=0;i<items.length;i++){
                        var item = items[i];
                        var formattedItem = {
                            "item_id": i,
                            "description": item.description,
                            "amount": item.staff_hourly_rate * item.qty,
                            "unit_price": item.staff_hourly_rate,
                            "qty": item.qty,
                            "subcontractors_id":item.subcontractors_id,
                            "item_type": item.item_type,
                            "commission_id": null,
                            "start_date": new Date(item.start_date),
                            "end_date": new Date(item.end_date),
                            "start_date_unix": moment(item.start_date).unix(),
                            "start_date_string": moment(item.start_date).format("YYYY-MM-DD"),
                            "end_date_unix": moment(item.end_date).unix(),
                            "end_date_string": moment(item.end_date).format("YYYY-MM-DD") 
                        }

                        invoice_items.push(formattedItem);
                    }
                }
                promiseAdjustmentItems.then(populateListAdjItems);
                var promiseCurrencyAdjustments = getCurrencyAdjustmentItems(client, previousMonth);
                promiseCurrencyAdjustments.then(populateListAdjItems);

                Q.allSettled([promiseAdjustmentItems, promiseCurrencyAdjustments]).then(function(){
                    var invoice = new Invoice();
                    invoice.items = invoice_items;
                    invoice.order_id = invoice_no;
                    invoice.added_on = atz.toDate();
                    invoice.added_by = "Remote Staff System";
                    invoice.added_on_formatted = atz.format();
                    invoice.type = "order";
                    invoice.pay_before_date = atz.add(5, "days").toDate();

                    invoice.save(function(err){
                        if (err){							
                            db.close();
                            done();
						}
						invoice.updateCouchdbDocument().then(function(body){
							invoice.couch_id = body.id;
							invoice.save(function(err){								
                                db.close();
                                done();
							});
						});
						setTimeout(function(){
							invoice.syncDailyRates();
						}, 1000);
						setTimeout(function(){
							invoice.syncVersion();
						}, 3000);
                    });

                });
            });
        });
    });

    console.log(job);

});
module.exports = invoiceCreationQueue;