
var Queue = require('bull');
var auto_creation_main = Queue("auto_creation_queue", 6379, '127.0.0.1');


var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');

var moment = require('moment');
var moment_tz = require('moment-timezone');

var invoice_creation = require("../bull/invoice_creation_process");
//client_settings Schema
var client_settings = require("../models/Client");


//schema for invoice creation track
var invoiceCreationTrack = require("../models/InvoiceCreationTrack");



auto_creation_main.process(function(job,done){

    var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod", mongoCredentials.options);
    var Client = db.model("Client", client_settings);
    var InvoiceCreation = db.model("InvoiceCreationTrack", invoiceCreationTrack);

    var clientID = (typeof job.data.id != "undefined" ? job.data.id  : null);


    var searchKey = {"client_doc.days_before_suspension": -30};

    if (clientID) {
        searchKey = {
            "client_doc.days_before_suspension": -30,
            client_id: parseInt(clientID)
        }
    }

    var delay = 1000;

    try {
        db.once('open', function () {


            InvoiceCreation.find({
                date_created: {
                    '$gte': new Date(moment_tz().format("YYYY-MM-01 00:00:00")),
                    '$lte': new Date(moment_tz().format("YYYY-MM-28 23:59:59"))
                }
            }).select({_id: 0, client_id: 1}).exec(function (err, track) {

                if (err) {
                    console.log(err);
                    db.close();
                    done(null,{success:true});
                }

                var ids = track.map(function (item) {
                    return item.client_id;
                });


                searchKey = {client_id: {$nin: ids}, "client_doc.days_before_suspension": -30};

                if (clientID) {
                    searchKey = {
                        "client_doc.days_before_suspension": -30,
                        client_id: parseInt(clientID)
                    }
                }


                Client.find(searchKey).select({_id: 0, client_id: 1}).exec(function (err, client_ids) {
                    if(err)
                    {
                        console.log(err);
                        done(null,{success:true});
                    }

                    function syncClient(i) {

                        if (i < 20) {

                            if(typeof client_ids[i] !== "undefined")
                            {

                                Q.delay(1000).done(function () {
                                    item = client_ids[i];
                                    invoice_creation.add({client_id: item.client_id});
                                    syncClient(i+1);
                                });
                            }
                            else
                            {
                                syncClient(i+1);
                            }

                        }
                        else {

                            if(i < client_ids.length)
                            {
                                Q.delay(15000).done(function () {
                                    client_ids.length = client_ids.length - 20;
                                    syncClient(1);
                                })

                            }
                            else
                            {
                                console.log("Done Creating Invoice(s)!");
                                done(null,{success:true});
                            }

                        }
                    }

                    db.close();
                    syncClient(0);

                });

            });

        });
    } catch (e) {

        console.log(e);
        done(null,{success:false});
    }

});

module.exports = auto_creation_main;