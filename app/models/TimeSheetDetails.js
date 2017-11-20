var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();


//Shema Fields

var fields ={

    id:{type:Number},
    timesheet_id:{type:Number},
    notes:[{
        text:{type:String},
        id:{type:Number},
        has_screenshot:{type:Boolean},
        notes_category:{type:String},
        file_name:{type:String},
        timestamp:{type:Date},
        working_hrs:{type:Number}
    }],
    day:{type:Number},
    adj_hrs:{type:Number},
    total_hrs:{type:Number},
    date_created:{type:Date},
    date_updated:{type:Date},
    adjusted:{type:String},
    user_info:{
        userid:{type:Number},
        fname:{type:String},
        lname:{type:String},
        email:{type:String}
    },
    subcon_details:{
        id:{type:Number},
        staff_email:{type:String}
    },
    assigned_sc:{
        admin_id:{type:Number},
        fname:{type:String},
        lname:{type:String},
        email:{type:String}
    },
    leads_info:{
        id:{type:Number},
        fname:{type:String},
        lname:{type:String},
        email:{type:String},
        status:{type:String}
    },
    status:{type:String}
};
var timesheetdetailsSchema  = new Schema(fields,{
        collection:"time_sheet_details"
});


module.exports = timesheetdetailsSchema;