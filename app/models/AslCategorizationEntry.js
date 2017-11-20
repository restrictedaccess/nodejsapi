var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var aslCategorizationEntry = new Schema({
    candidate_id:Number,
    jsca_id:Number,
    admin_id:Number,
    shownOnASL:Boolean, //job_sub_category_applicants.ratings
    dateCreated:Date, //job_sub_category_applicants.sub_category_applicants_date_created

    category_info:{
        category_id: Number,
        status: String,
        category_name: String,
        singular_name: String,
        created_by: Number,
        url: String,
        description: String,
        title: String,
        meta_description: String,
        keywords: String,
    },
    sub_category_info:{
        sub_category_id: Number,
        category_id: Number,
        status: String,
        sub_category_name: String,
        singular_name: String,
        url: String,
        description: String,
        title: String,
        meta_description: String,
        keywords: String,
        page_header: String
    },
}, {
    collection:"asl_categorization_entries"
});


aslCategorizationEntry.methods.saveFromMysql = function(mysql_data){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var AslCategorizationEntries = db.model("AslCategorizationEntries", aslCategorizationEntry);

    var search_key = {jsca_id: parseInt(mysql_data.id)};

    db.once('open', function () {

        var entry = {};
        //create entry
        if(mysql_data.id){
            entry.jsca_id = parseInt(mysql_data.id);
        }

        entry.shownOnASL = false;

        if(mysql_data.userid){
            entry.candidate_id = parseInt(mysql_data.userid);
        }

        if(mysql_data.ratings == 0){
            entry.shownOnASL = true;
        }

        if(mysql_data.admin_id){
            entry.admin_id = mysql_data.admin_id;
        }

        if(mysql_data.sub_category_applicants_date_created){
            entry.dateCreated = mysql_data.sub_category_applicants_date_created;
        }

        if(mysql_data.category_info){
            entry.category_info = mysql_data.category_info;
        }

        if(mysql_data.sub_category_info){
            entry.sub_category_info = mysql_data.sub_category_info;
        }

        function updateMongoDoc(data, callback){
            AslCategorizationEntries.update(search_key, data, {upsert: true}, callback);
        }


        AslCategorizationEntries.findOne(search_key).exec(function(err, foundDoc){
            if (err) {
                db.close();
                willFulfillDeferred.resolve(null);
                //return res.status(200).send({success: false, error: err});
            }

            if(foundDoc){
                //update

                updateMongoDoc(entry, function(err){
                    if(err){
                        console.log(err);
                        willFulfillDeferred.resolve(null);
                    }
                    console.log("entry updated " + entry.jsca_id);
                    willFulfillDeferred.resolve(foundDoc);

                });
            } else{
                //insert
                foundDoc = new AslCategorizationEntries(entry);

                foundDoc.save(function(err){
                    if (err){
                        console.log(err);
                        willFulfillDeferred.resolve(null);
                    }
                    console.log("entry inserted " + entry.jsca_id);
                    willFulfillDeferred.resolve(foundDoc);
                });

            }
        });

    });

    return willFulfill;
};


aslCategorizationEntry.methods.fetchOneBy = function(query){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var AslCategorizationEntries = db.model("AslCategorizationEntries", aslCategorizationEntry);


    db.once('open', function () {

        AslCategorizationEntries.findOne(query).exec(function (err, fetch_entry) {
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            db.close();
            willFulfillDeferred.resolve(fetch_entry);
        });

    });


    return willFulfill;

}


aslCategorizationEntry.methods.fetchManyBy = function(query){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var AslCategorizationEntries = db.model("AslCategorizationEntries", aslCategorizationEntry);


    db.once('open', function () {

        AslCategorizationEntries.find(query).exec(function (err, fetch_entries) {
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            db.close();
            willFulfillDeferred.resolve(fetch_entries);
        });

    });


    return willFulfill;

}

module.exports = aslCategorizationEntry;