var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var priceFullTimeSchema = new Schema({
    id:Number,
    code:String,
    details:Array,
    label:String
}, {
    collection:"price_full_time_collection"
});



priceFullTimeSchema.methods.fetchById = function(id){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var PriceFullTime = db.model("PriceFullTime", priceFullTimeSchema);


    db.once('open', function () {

        PriceFullTime.findOne({id:id}).exec(function (err, fetched_full_time_price) {
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            db.close();
            willFulfillDeferred.resolve(fetched_full_time_price);
        });

    });


    return willFulfill;

}

module.exports = priceFullTimeSchema;