var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");


var fields = {

    order_id:{type:String},
    admin:{
        id:{type:Number},
        name:{type:String}
    },
    notes:{type:String},
    date:{type:Date}


}

var readyForReleaseNoteSchema = new Schema(fields,
    {collection:"ready_for_release_notes"});


module.exports = readyForReleaseNoteSchema;


