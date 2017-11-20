var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();



var schema_fields = {

    count : {type:Number},
    order_id : {type:String},
    history : {type:Array},

}

var invoiceEmailResentSparkpostSchema = new Schema(schema_fields,
    {collection:"invoice_email_resent_sparkpost"});




invoiceEmailResentSparkpostSchema.methods.addInvoiceHistory = function(order_id, changes, by){
    var invoiceSchema = require("../models/Invoice");
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var Invoice = db.model("Invoice", invoiceSchema);

    db.once('open', function () {
        Invoice.findOne({order_id: order_id}).exec(function(err, invoice_doc){
            if(invoice_doc){

                if(typeof invoice_doc.history == "undefined"){
                    invoice_doc.history = [];
                }

                invoice_doc.history.push(
                    {
                        timestamp: new Date(),
                        changes: changes,
                        by: by
                    }
                );


                invoice_doc.save(function(err){
                    if (err){
                        console.log(err);
                        db.close();
                        result = {success:false, errors:err};
                        //return res.send(result, 200);
                    }

                    invoice_doc.updateCouchdbDocument().then(function(body){

                    });

                    db.close();

                    result = {success:true, order_id:invoice_doc.order_id};
                    //return res.send(result, 200);
                });
            }
            willFulfillDeferred.resolve(invoice_doc);

        });
    });

    return willFulfill;

};


module.exports = invoiceEmailResentSparkpostSchema;
