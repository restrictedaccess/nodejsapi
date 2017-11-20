var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var mongoCredentials = configs.getMongoCredentials();
var fields = {
	
	key : {type:String},
	message : {type:String},
	app : {type:String},
	sent : Boolean,
	date_sent : Date,
	received : Boolean,
	date_received : Date	
};

var notificationsSchema = new Schema(fields,
{collection:"notifications"});



notificationsSchema.methods.getOneData = function(_id, isLean, selectedFields){

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
    var Notifications = db.model("Notifications", notificationsSchema);

    db.once("open", function(){
        var query = Notifications.findOne({
            "_id": _id
        });

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){

            db.close();
            if(err) console.log(err);
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;

}


notificationsSchema.methods.saveData = function(data) {

    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;


    try{
        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
        var Notifications = db.model("Notifications", notificationsSchema);


        function updateMongoDoc(data, callback){
            Notifications.update({_id: data._id}, data, {upsert: true}, callback);
        }

        db.once("open", function(){
            var NotificationsObj = new Notifications(data);


            NotificationsObj.getOneData(data._id, true, {_id:0}).then(function(foundDoc){

                if(foundDoc){
                    //update
                    updateMongoDoc(data, function(err){
                        db.close();
                        if(err){
                            console.log(err);
                            willDefer.resolve(null);
                        }

                        console.log("Notification updated to mongo");
                        willDefer.resolve(foundDoc);
                    });
                } else{

                    //insert
                    foundDoc = new Notifications(data);

                    foundDoc.save(function(err){
                        db.close();
                        if (err){
                            console.log(err);
                            willDefer.resolve(null);
                        }
                        console.log("New notification inserted to mongo");
                        willDefer.resolve(foundDoc);
                    });
                }

            });
        });

    } catch(major_error){
        consol.log(major_error);
    }

    return willFullfill;

}

module.exports = notificationsSchema;