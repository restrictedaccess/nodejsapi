var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var pricePartTimeSchema = new Schema({
    id:Number,
    code:String,
    details:Array,
    label:String
}, {
    collection:"price_part_time_collection"
});



pricePartTimeSchema.methods.fetchById = function(id){
    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var PricePartTime = db.model("PricePartTime", pricePartTimeSchema);


    db.once('open', function () {

        PricePartTime.findOne({id:id}).exec(function (err, fetched_part_time_price) {
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            db.close();
            willFulfillDeferred.resolve(fetched_part_time_price);
        });

    });


    return willFulfill;

}


module.exports = pricePartTimeSchema;