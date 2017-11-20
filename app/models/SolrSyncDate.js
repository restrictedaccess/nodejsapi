var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');
var moment = require('moment');

var mongoCredentials = configs.getMongoCredentials();

var solrSyncedByDatesSchema = new Schema({
    date_from:{type:Date},
    date_to:{type:Date},
    processed:{type:Boolean},
}, {
    collection:"solr_synced_by_dates"
});


solrSyncedByDatesSchema.methods.createDates = function(){
    function delay() {
        return Q.delay(100);
    }
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var first_date = 2007;

    var last_date = parseInt(moment().format("YYYY"));
    var month_today = moment().format("MM");

    var all_save_promises = [];

    function saveData(data){
        var saveDeferred = Q.defer();
        var savePromise = saveDeferred.promise;


        var db = mongoose.createConnection("mongodb://" + mongoCredentials.host + ":" + mongoCredentials.port + "/prod");

        var SolrSyncDate = db.model("SolrSyncDate", solrSyncedByDatesSchema);

        db.once('open', function () {
            function updateMongoDoc(data, callback){
                SolrSyncDate.update({
                    date_from: data.date_from,
                    date_to: data.date_to
                }, data, {upsert: true}, callback);
            }

            SolrSyncDate.findOne({
                date_from: data.date_from,
                date_to: data.date_to
            }).exec(function(err, foundDoc){
                if (err) {
                    db.close();
                    saveDeferred.resolve(null);
                    //return res.status(200).send({success: false, error: err});
                }

                if(foundDoc){
                    //update
                    //
                    // updateMongoDoc(data, function(err){
                    //     db.close();
                    //     if(err){
                    //         saveDeferred.resolve(null);
                    //         return res.status(200).send({success: false, error: err});
                    //     }
                    //     console.log("saved");
                    //     console.log(data);
                    //     saveDeferred.resolve(foundDoc);
                    // });
                    console.log("already created");
                    console.log(data);
                    saveDeferred.resolve(foundDoc);
                } else{
                    //insert
                    foundDoc = new SolrSyncDate(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            saveDeferred.resolve(null);
                            return res.status(200).send({success: false, error: err});
                        }
                        console.log("inserted");
                        console.log(data);
                        saveDeferred.resolve(foundDoc);
                    });

                }
            });
        });

        return savePromise;
    }


    for(var i = first_date;i <= last_date;i++){
        var year = i;
        for(var j = 1;j <= 12;j++){
            var padded = j.toString();
            if(padded.length == 1){
                padded = "0" + padded;
            }
            var month = padded;

            if(month > month_today && i == last_date){
                break;
            } else{
                var date = new Date(Date.parse(year + "-" + month + "-01"));
                var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
                var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

                var data = {
                    date_from: firstDay,
                    date_to: lastDay,
                    processed: false
                };

                all_save_promises.push(saveData(data));
                all_save_promises.push(delay);
            }

        }

    }

    var allSavePromises = Q.allSettled(all_save_promises);
    allSavePromises.then(function (results) {
        console.log("all saved!");
        willFulfillDeferred.resolve(true);
    });



    return willFulfill;


};


module.exports = solrSyncedByDatesSchema;