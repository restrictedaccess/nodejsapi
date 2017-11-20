var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var clientInvoiceCreationSchema = new Schema({
    _id:{type:Number},
    client_id:Number,
    fname:String,
    lname:String,
    email:String,
    currency:String,
    they_owe_us:String,
    awaiting_invoices:Array,
    apply_gst:String,
    active_subcons:Array,

}, {
    collection:"client_invoice_creation"
});



clientInvoiceCreationSchema.methods.saveClientData = function(data) {
    try{

        var me = this;

        var willFulfillDeferred = Q.defer();
        var willFulfill = willFulfillDeferred.promise;


        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
        var ClientInvoiceCreation = db.model("ClientInvoiceCreation", clientInvoiceCreationSchema);

        var search_key = {"_id" : parseInt(data.client_id)};

        data["_id"] = parseInt(data.client_id);

        db.once("open", function(){

            function updateMongoDoc(data, callback){
                ClientInvoiceCreation.update(search_key, data, {upsert: true}, callback);
            }

            ClientInvoiceCreation.findOne(search_key).exec(function(err, foundDoc){
                if (err) {
                    db.close();
                    willFulfillDeferred.resolve(null);
                }

                if(foundDoc){
                    //update
                    try{
                        delete data._id;
                    } catch(error){
                        console.log("error deleting _id");
                        console.log(error);
                    }

                    updateMongoDoc(data, function(err){
                        if(err){
                            willFulfillDeferred.resolve(null);
                        }
                        console.log("updated to client_invoice_creation");
                        db.close();
                        willFulfillDeferred.resolve(foundDoc);
                    });
                } else{
                    //insert
                    foundDoc = new ClientInvoiceCreation(data);

                    foundDoc.save(function(err){
                        if (err){
                            willFulfillDeferred.resolve(null);
                        }
                        console.log("insert to client_invoice_creation");
                        db.close();
                        willFulfillDeferred.resolve(foundDoc);
                    });

                }
            });
        });

    } catch(major_error){
        console.log("major_error");
        console.log(major_error);
    }
    return willFulfill;
}




module.exports = clientInvoiceCreationSchema;