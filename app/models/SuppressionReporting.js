var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var clientInfoSchema = require("../models/Client");
var personalInfoSchema = require("../mysql/Personal_Info");
var leadInfoSchema = require("../mysql/Lead_Info");
var subconSchema = require("../mysql/Subcontractors");

var schema_fields = {

    first_name : {type:String},
    last_name : {type:String},
    full_name: {type:String},
    account_id : {type:Number},
    email : {type:String},
    account_type : {type:String},
    reason: {type:String},
    created: {type:Date},
    status: {type:String},
    suppression_type: {type:String},

}

var suppressionReportingSchema = new Schema(schema_fields,
    {collection:"suppression_reporting"});


suppressionReportingSchema.methods.saveInvoiceNotes = function(notes, order_id){

    var invoiceSchema = require("../models/Invoice");

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var Invoice = db.model("Invoice", invoiceSchema);

    var Suppression = db.model("Suppression", suppressionReportingSchema);

    db.once('open', function () {
        console.log("prod db opened! " + order_id);
        Invoice.findOne({order_id: order_id}).exec(function(err, invoice_doc){
            if(invoice_doc){

                //var new_invoice = new Invoice(invoice_doc);
                if(typeof invoice_doc.comments == "undefined"){
                    invoice_doc.comments = [];
                }

                invoice_doc.comments.push({
                    "date": new Date(),
                    "comment": notes,
                    "name": "RS System"
                });

                if(typeof invoice_doc.history == "undefined"){
                    invoice_doc.history = [];
                }

                invoice_doc.history.push({
                    "timestamp": new Date(),
                    "changes": "Added note: " + notes,
                    "by": "RS System"
                });



                invoice_doc.save(function(err){
                    if (err){
                        console.log(err);
                        db.close();
                        result = {success:false, errors:err};
                        //return res.send(result, 200);
                    }

                    invoice_doc.updateCouchdbDocument().then(function(body){

                    });


                    result = {success:true, order_id:invoice_doc.order_id};
                    //return res.send(result, 200);
                });




                willFulfillDeferred.resolve({success: true});

            } else{
                willFulfillDeferred.resolve({success: false});
            }

        });
    });

    return willFulfill;

}


suppressionReportingSchema.methods.fetchSuppressionDetails = function(current_data){

    var emailInvoiceSchema = require("../models/EmailInvoice");
    var invoiceSchema = require("../models/Invoice");
    function delay(){ return Q.delay(100); }
    //var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/invoice");
    var db = this.db;

    var db_prod = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var Client = db_prod.model("Client", clientInfoSchema);

    var EmailInvoice = db.model("EmailInvoice", emailInvoiceSchema);

    var Suppression = db.model("Suppression", suppressionReportingSchema);

    var Invoice = db_prod.model("Invoice", invoiceSchema);

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var me = this;

    me.email = current_data.email;
    me.reason = current_data.reason;
    me.created = current_data.created;
    me.suppression_type = current_data.suppression_type;

    //db.once('open', function() {
    db_prod.once('open', function () {

        Suppression.findOne({email: me.email}).exec(function(err, doc){

            if(err){
                console.log(err);
                willFulfillDeferred.resolve(false);
            }

            if(!doc){
                console.log(current_data.email + " NOT YET SAVED!");
                var client_info_fetched = null;
                var leads_info_fetched = null;
                var subcon_info_fetched = null;
                var personal_info_fetched = null;

                var allFetchingPromises = [];

                var clientInfoFetchDeferred = Q.defer();
                var clientInfoFetchPromise = clientInfoFetchDeferred.promise;
                allFetchingPromises.push(clientInfoFetchPromise);
                allFetchingPromises.push(delay);



                var leadsInfoFetchDeferred = Q.defer();
                var leadsInfoFetchPromise = leadsInfoFetchDeferred.promise;
                allFetchingPromises.push(leadsInfoFetchPromise);
                allFetchingPromises.push(delay);




                var subconInfoFetchDeferred = Q.defer();
                var subconInfoFetchPromise = subconInfoFetchDeferred.promise;
                allFetchingPromises.push(subconInfoFetchPromise);
                allFetchingPromises.push(delay);





                var personalInfoFetchDeferred = Q.defer();
                var personalInfoFetchPromise = personalInfoFetchDeferred.promise;
                allFetchingPromises.push(personalInfoFetchPromise);
                allFetchingPromises.push(delay);




                Client.findOne({email: current_data.email}).exec(function(err, foundClientInfo){
                    if(foundClientInfo){
                        foundClientInfo.getMongoActiveSubcons().then(function(activeSubcons){
                            //console.log(activeSubcons);
                            if(activeSubcons.length > 0){
                                client_info_fetched = current_data;
                                client_info_fetched["account_id"] = foundClientInfo.id;
                                client_info_fetched["first_name"] = foundClientInfo.fname;
                                client_info_fetched["last_name"] = foundClientInfo.lname;
                                client_info_fetched["full_name"] = foundClientInfo.fname + " " + foundClientInfo.lname;
                                client_info_fetched["account_type"] = "client";
                                clientInfoFetchDeferred.resolve({success:true, result: client_info_fetched});
                            } else{
                                clientInfoFetchDeferred.resolve({success:false});
                            }
                        });
                    } else{
                        clientInfoFetchDeferred.resolve({success:false});
                    }
                });

                clientInfoFetchDeferred.resolve({success:false});


                leadInfoSchema.findOne({
                    attributes:
                        ['fname','lname','email', "id"],
                    where:
                    {
                        email:current_data.email
                    }
                }).then(function(foundObject){

                    if(foundObject){
                        leads_info_fetched = current_data;
                        leads_info_fetched["account_id"] = foundObject.id;
                        leads_info_fetched["first_name"] = foundObject.fname;
                        leads_info_fetched["last_name"] = foundObject.lname;
                        leads_info_fetched["full_name"] = foundObject.fname + " " + foundObject.lname;
                        leads_info_fetched["account_type"] = "leads";
                        leadsInfoFetchDeferred.resolve({success:true, result: leads_info_fetched});

                    } else{
                        leadsInfoFetchDeferred.resolve({success:false});
                    }
                })



                subconSchema.findOne({
                    attributes:
                        ['staff_email', "userid"],
                    where:
                    {
                        staff_email:current_data.email
                        // staff_email:"rhea.122413.12083@remotestaff.net"
                    }
                }).then(function(foundObject){

                    if(foundObject){
                        personalInfoSchema.findOne({
                            attributes:
                                ['fname', "lname", "userid"],
                            where:
                            {
                                userid: foundObject.userid
                            }
                        }).then(function(foundPersonalInfoSubcon){
                            if(foundPersonalInfoSubcon){

                                subcon_info_fetched = current_data;
                                subcon_info_fetched["account_id"] = foundObject.userid;
                                subcon_info_fetched["first_name"] = foundPersonalInfoSubcon.fname;
                                subcon_info_fetched["last_name"] = foundPersonalInfoSubcon.lname;
                                subcon_info_fetched["full_name"] = foundPersonalInfoSubcon.fname + " " + foundPersonalInfoSubcon.lname;
                                subcon_info_fetched["account_type"] = "subcontractor";

                                subconInfoFetchDeferred.resolve({success:true, result: subcon_info_fetched});
                            } else{
                                subconInfoFetchDeferred.resolve({success:false});
                            }

                        });

                    } else{
                        subconInfoFetchDeferred.resolve({success:false});
                    }
                });

                personalInfoSchema.findOne({
                    attributes:
                        ['fname', "lname", "userid"],
                    where:
                    {
                        // staff_email:data.email
                        email:current_data.email
                        // email:"testcandiv2@gmail.com"
                    }
                }).then(function(foundPersonalInfo){
                    if(foundPersonalInfo){
                        personal_info_fetched = current_data;
                        personal_info_fetched["account_id"] = foundPersonalInfo.dataValues["userid"];
                        personal_info_fetched["first_name"] = foundPersonalInfo.fname;
                        personal_info_fetched["full_name"] = foundPersonalInfo.fname + " " + foundPersonalInfo.lname;
                        personal_info_fetched["last_name"] = foundPersonalInfo.lname;
                        personal_info_fetched["account_type"] = "personal";

                        personalInfoFetchDeferred.resolve({success:true, result: personal_info_fetched});
                    } else{
                        personalInfoFetchDeferred.resolve({success:false});
                    }
                });


                var allFetchPromise = Q.allSettled(allFetchingPromises);
                allFetchPromise.then(function(results){
                    console.log("All promises done! for " + current_data.email);


                    var current_info = null;

                    if(client_info_fetched){
                        current_info = client_info_fetched;
                    } else if(leads_info_fetched){
                        current_info = leads_info_fetched;
                    } else if(subcon_info_fetched){
                        current_info = subcon_info_fetched;
                    } else if(personal_info_fetched){
                        current_info = personal_info_fetched;
                    }

                    if(current_info){
                        me.first_name = current_info.first_name;
                        me.last_name = current_info.last_name;
                        me.full_name = current_info.full_name;
                        me.account_id = current_info.account_id;
                        me.account_type = current_info.account_type;


                        me.save(function(err){
                            if (err){
                                console.log(err);
                                result = {success:false, errors:err};
                            } else{
                                console.log("Saved to suppression_reporting " + me.email);
                            }


                            EmailInvoice.find({"email": {'$regex' : me.email, '$options' : 'i'}}).exec(function(err,reports){
                                if(reports.length > 0){
                                    console.log("delivered_invoices record FOUND!");
                                    var invoiceUpdatePromises = [];
                                    for(var j = 0;j < reports.length;j++){

                                        var invoiceUpdateDeferred = Q.defer();
                                        var invoiceUpdatePromise = invoiceUpdateDeferred.promise;
                                        invoiceUpdatePromises.push(invoiceUpdatePromise);
                                        invoiceUpdatePromises.push(delay);


                                        var report_data = reports[j];
                                        var notes = "";
                                        if(me.suppression_type == "bounces"){
                                            report_data.email_status = "Bounce";
                                            notes = "Bounced: Email bounced - email address is wrong - check with client";
                                        } else if(me.suppression_type == "blocks"){
                                            report_data.email_status = "Block";
                                            notes = "Blocked: Email is being blocked - ask client for alternative email address";
                                        } else if(me.suppression_type == "spam_reports"){
                                            report_data.email_status = "Spam";
                                            notes = "Spam: Email is blocked by spam filter - check with client";
                                        } else if(me.suppression_type == "invalid_emails"){
                                            report_data.email_status = "Invalid";
                                            notes = "Invalid Email: Something wrong with the email address - check with client";
                                        }

                                        report_data.date_updated = new Date();


                                        var updated_report_data = new EmailInvoice(report_data);
                                        updated_report_data.save(function(err_report){
                                            if (err_report){
                                                console.log(err_report);
                                                result = {success:false, errors:err_report};
                                            } else{
                                                console.log("Updated to delivered_invoices " + updated_report_data._id);
                                            }

                                            //db.close();
                                            invoiceUpdateDeferred.resolve(true);

                                            willFulfillDeferred.resolve({success: true});
                                        });



                                        Invoice.findOne({order_id: report_data.accounts_order_id}).exec(function(err, invoice_doc){
                                            if(invoice_doc){

                                                if(typeof invoice_doc.comments == "undefined"){
                                                    invoice_doc.comments = [];
                                                }

                                                invoice_doc.comments.push({
                                                    "date": new Date(),
                                                    "comment": notes,
                                                    "name": "RS System"
                                                });


                                                if(typeof invoice_doc.history == "undefined"){
                                                    invoice_doc.history = [];
                                                }

                                                invoice_doc.history.push({
                                                    "timestamp": new Date(),
                                                    "changes": "Added note: " + notes,
                                                    "by": "RS System"
                                                });

                                                //var new_invoice = new Invoice(invoice_doc);

                                                invoice_doc.save(function(err){
                                                    if (err){
                                                        db.close();
                                                        result = {success:false, errors:err};

                                                        willFulfillDeferred.resolve({success: false});
                                                    }
                                                    console.log(invoice_doc._id + " Invoice Id");
                                                    invoice_doc.updateCouchdbDocument().then(function(body){
                                                        invoice_doc.couch_id = body.id;
                                                        invoice_doc.save(function(err){
                                                            db.close();
                                                        });
                                                    });
                                                    setTimeout(function(){
                                                        invoice_doc.syncDailyRates();
                                                    }, 1000);
                                                    setTimeout(function(){
                                                        invoice_doc.syncVersion();
                                                    }, 3000);

                                                    result = {success:true, order_id:invoice_doc.order_id};

                                                });
                                                willFulfillDeferred.resolve({success: true});

                                            } else{
                                                willFulfillDeferred.resolve({success: false});
                                            }

                                        });

                                    }



                                    var allEmailPromise = Q.allSettled(invoiceUpdatePromises);
                                    allEmailPromise.then(function(results){
                                        console.log(me.email + " Should resolve!");
                                    });
                                } else{
                                    console.log("delivered_invoices record NOT FOUND!");
                                    willFulfillDeferred.resolve({success:false});
                                }


                            });


                        });

                    } else{

                        willFulfillDeferred.resolve({success:false});
                    }



                    //return res.status(200).send({success:true});
                });
            } else{
                console.log(current_data.email + " already saved!");
                willFulfillDeferred.resolve({success:false});
            }


        });



   });



    return willFulfill;
};


module.exports = suppressionReportingSchema;