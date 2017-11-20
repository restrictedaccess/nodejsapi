var Q = require('q');



var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var quoteMongoSchema = require("../models/QuoteModel");
var moment = require('moment');
var moment_tz = require('moment-timezone');


var env = require("../config/env");

var sha1 = require('locutus/php/strings/sha1');

var notificationsSchema = require("../models/Notifications");


// much more concise declaration
function WebsocketConnection(port) {

}


WebsocketConnection.prototype.sendWebsocketNotification = function(data){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
    var Notifications = db.model("Notifications", notificationsSchema);
    var NotificationsObj = new Notifications();

    db.once("open", function(){
        db.close();
    });

    NotificationsObj.saveData(data);

};



WebsocketConnection.prototype.receiveWebsocketNotification = function(_id){

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");
    var Notifications = db.model("Notifications", notificationsSchema);
    var NotificationsObj = new Notifications();

    var data = {
        _id: _id,
        received: true,
        date_received: configs.getDateToday()
    }

    db.once("open", function(){
        db.close();
    });

    NotificationsObj.saveData(data);

};




module.exports = WebsocketConnection;