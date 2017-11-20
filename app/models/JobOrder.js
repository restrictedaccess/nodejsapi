var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');



var mongoCredentials = configs.getMongoCredentials();
var jobOrderSchema = new Schema({

	date_closed:Date,
	jsca_id:String,
	date_filled_up:Date,
	working_timezone:String,
	tracking_code:String,
	currency:String,
	work_status:String,
	budget_monthly:Number,
	hc_lname:String,
	hc_fname:String,
	shortlisted:Array,
	bp_fname:String,
	gs_job_titles_details_id:Number,
	last_contact:Date,
	no_of_staff_needed:Number,
	deleted:Boolean,
	posting_id:Number,
	jr_list_id:Number,
	leads_id:Number,
	service_type:String,
	order_status:String,
	job_title:String,
	status:String,
	job_order_sub_category_id:Number,
	budget_hourly:Number,
	timestamp:Date,
	jr_cat_id:Number,
	assigned_hiring_coordinator_id:Number,
	proposed_start_date:String,
	rejected:Array,
	interviewed:Array,
	recruiters:Array,
	assigned_recruiter_id:Number,
	created_reason:String,
	merged_order_id:String,
	status_last_update:Date,
	lead_lastname:String,
	hired:Array,
	merge_status:String,
	bp_lname:String,
	level:String,
	lead_firstname:String,
	asl_order_id:String,
	business_partner_id:Number,
	ontrial:Array,
	client:String,
	sub_order_status:String,
	cancelled:Array,
	gs_job_role_selection_id:Number,
	endorsed:Array,
	age:Number
},
{collection:"job_orders"});



jobOrderSchema.methods.getAllByQuery = function(query, selectedFields){

	var me = this;

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

	var JobOrder = db.model("JobOrder", jobOrderSchema);


	db.once('open', function () {

		var findObj = JobOrder.find(query);

		if(selectedFields){
			// findObj.select({ "name": 1, "_id": 0})
			findObj.select(selectedFields);
		}

		findObj.lean().exec(function (err, fetched_job_orders) {
			if(err){
				console.log(err);
				willFulfillDeferred.resolve(null);
			}
			db.close();
			willFulfillDeferred.resolve(fetched_job_orders);
		});

	});

	return willFulfill;
}



jobOrderSchema.methods.getOneByQuery = function(query, selectedFields){

    var me = this;

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var JobOrder = db.model("JobOrder", jobOrderSchema);


    db.once('open', function () {

        var findObj = JobOrder.findOne(query);

        if(selectedFields){
            // findObj.select({ "name": 1, "_id": 0})
            findObj.select(selectedFields);
        }

        findObj.lean().exec(function (err, fetched_job_orders) {
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            db.close();
            willFulfillDeferred.resolve(fetched_job_orders);
        });

    });

    return willFulfill;
}



module.exports = jobOrderSchema;