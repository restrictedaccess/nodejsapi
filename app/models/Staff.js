var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");


var staffSchema = new Schema({
	userid:Number,
	candidate_details:{
		fname:String,
		lname:String,
		email:String
	}
},
{collection:"candidates_progress"});


var subcontractorsSchema = new Schema({
	subcontractors_id:Number,
	userid:Number,
	personal_detail:{
		fname:String,
		lname:String,
		email:String
	},
	recruiters_detail:{
		id:Number,
		fname:String,
		lname:String
	},
	leads_detail:{
		id:Number,
		fname:String,
		lname:String,
		email:String
	},
	staffing_consultant_detail:{
		admin_id:Number,
		fname:String,
		lname:String
	},
	subcontractors_detail:{
		staff_email:String,
		client_price:Number,
	    php_monthly:Number,
	    current_rate:Number,
	    revenue:Number,
	    replacement_request:String,
	    skype_id:String,
	    client_timezone:String,
	    job_designation:String,
	    service_type:String,
	    status:String,
	    work_status:String,
	    staff_start_work_hour:String,
	    staff_finish_work_hour:String,
	    client_start_work_hour:String,
	    client_finish_work_hour:String,
	    staff_working_timezone:String,
	    cancelled_contract_length_precision:Number,
	    date_contracted:Date,
	    starting_date:Date
	}
},
{collection:"subcontractors_reporting"});

staffSchema.virtual('subcontractors_detail.starting_date_string').get(function () {
  var starting_date =  this.subcontractors_detail.starting_date;
  var date =  new Date(starting_date);
  return date.toDateString();
});


staffSchema.methods.getContracts = function(callback){
	var Subcontractors = mongoose.model("Subcontractors", subcontractorsSchema);
	Subcontractors.find({userid:this.userid}).where('subcontractors_detail.status').in(['ACTIVE', 'suspended', 'terminated', 'resigned']).lean().exec(callback);
};



module.exports = staffSchema;