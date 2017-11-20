
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
http.post = require("http-post");

//import ClientsSchema
var clientSchema = require("../models/Client");


var mongoCredentials = configs.getMongoCredentials();


module.exports = {
    processPerClient: function (job, done) {
        console.log("Processing per client "+job.data.processClient.id);

        var search_key = {};
        if(job.data.processClient.id){
            var id = parseInt(job.data.processClient.id);
            search_key={client_id:id};
        } else{
            console.log("job.data.processClient.id is required!");
            done();
        }


        function getAllCandidates(page){
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
            var Client = db.model("Client", clientSchema);
            var deferredPromiseCandidates = Q.defer();
            var deferredPromiseCandidatesPromise = deferredPromiseCandidates.promise;
            var clients=[];
            var promises = [];

            db.once('open', function(){
                if (typeof page=="undefined"){
                    page = 1;
                }


                var clients = [];
                var skips = (page-1) * 300;

                Client.find(search_key)
                    .skip(skips)
                    .limit(300)
                    .sort({ 'lead.fname' : 'asc', 'lead.lname' : 'asc'}).exec(function(err, docs){
                    //console.log(docs);
                    if (!err){
                        for(var i=0;i<docs.length;i++){
                            //initialise empty object

                            function client_output(){

                            }

                            var temp = new client_output();
                            item = docs[i];

                            var per_client_promises = [];
                            function delay(){ return Q.delay(100); }
                            item.db = db;

                            //set promise per client to do multi tasking
                            var promise_invoice = item.getInvoices("new", false);
                            var promise_subcons = item.getMongoActiveSubcons();

                            per_client_promises.push(promise_invoice);
                            //per_client_promises.push(delay);
                            per_client_promises.push(promise_subcons);
                            //per_client_promises.push(delay);


                            per_client_promises_promise = Q.all(per_client_promises);
                            per_client_promises_promise.then(function(result){
                                //console.log(result);
                                return true;
                            });
                            promises.push(per_client_promises_promise);
                            //promises.push(delay);

                        }
                    }

                    var allPromise = Q.all(promises);
                    allPromise.then(function(results){
                        console.log("All promises done noww!!!!!");
                        //console.log(docs);
                        try{
                            for(var i=0;i<docs.length;i++){
                                clients.push(docs[i].getInvoiceCreationView());
                            }
                            db.close();
                            deferredPromiseCandidates.resolve(clients);
                        }catch(e){
                            db.close();
                            deferredPromiseCandidates.resolve(e.message);
                        }

                    });
                });

            });

            return deferredPromiseCandidatesPromise;
        }


        function saveData(data){
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);
            var clientInvoiceCreationSchema = require("../models/ClientInvoiceCreation");
            var ClientInvoiceCreationModel = db.model("ClientInvoiceCreation", clientInvoiceCreationSchema);
            var clientInvoiceCreationObj = new ClientInvoiceCreationModel();

            var defer = Q.defer();

            clientInvoiceCreationObj.saveClientData(data).then(function(result){

                defer.resolve(data);
            });


            return defer.promise;
        }


        if(job.data.processClient.id){
            getAllCandidates(1).then(function(result){

                if(result.length > 0){
                    saveData(result[0]).then(function(saved){
                        console.log('All Clients creation saving DONE!');
                        done();
                    });
                } else{
                    console.log("No clients to sync");
                    done();
                }

            });
        }

    }
}