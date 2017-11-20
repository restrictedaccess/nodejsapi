var Q = require('q');
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();



var moment = require('moment');
var moment_tz = require('moment-timezone');
var env = require("../config/env");


var Xero = function(){};


// fetching the contact
// sync contact if not yet synced
Xero.prototype.fetchContact = function (client_id) {

    var willDefer = Q.defer();
    var willfullfill = willDefer.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/xero", mongoCredentials.options);

    var XeroContactSchema = require("../models/XeroContact");
    var XeroContactModel = db.model("XeroContact", XeroContactSchema);

    db.once("open", function(){
        console.log("fetching contact " + client_id);
        XeroContactModel.findOne({ContactNumber: client_id.toString()}).lean().exec(function(err, foundContact){
            if(foundContact){
                willDefer.resolve(foundContact);
            } else{
                var clientBull = require("../bull/xero/client");

                clientBull.processPerClient(
                    {
                        data: {
                            processClient: {
                                id: parseInt(client_id)
                            }
                        }
                    },
                    function(err, result){
                        if(err) willDefer.resolve(null);

                        willDefer.resolve(result.result);
                    }
                );

            }
        });
    });

    return willfullfill;
}

module.exports = new Xero();
