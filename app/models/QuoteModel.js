var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var moment = require('moment');
var business = require('moment-business');


var mongoCredentials = configs.getMongoCredentials();

var quoteMongoSchema = new Schema({

      quote_id:Number,
      created_by:Number,
      created_by_type:String,
      leads_id:Number,
      leads_details:[{
        fname:String,
        lname:String,
        email:String
      }],
      date_quoted:Date,
      quote_no:Number,
      status:String,
      date_posted:Date,
      ran:String,
      quote_details:
      [{
          id:Number,
          work_position:String,
          userid:Number,
          user_fname:String,
          user_lname:String,
          user_email:String,
          salary:Number,
          client_timezone:String,
          client_start_work_hour:String,
          client_finish_work_hour:String,
          lunch_start: String,
      		lunch_out: String,
      		work_start: String,
      		work_finish: String,
      		working_hours: String,
      		days: String,
      		quoted_price: Number,
      		work_status: String,
      		currency: String,
      		work_description: String,
      		notes: String,
      		currency_fee: Number,
      		currency_rate: Number,
      		gst: Number,
      		no_of_staff: String,
      		quoted_quote_range: String,
      		staff_country: String,
      		staff_timezone: String,
      		staff_currency: String,
      		detail_status: String,
      		starting_date: Date,
      		tracking_code: String,
      		service_fee: String,
      		office_fee: String,
      		currency_adjustment: String,
      		others: String,
      		gst_apply: String

      }],

      service_agreement:
      [{
        service_agreement_id : Number,
      	created_by: Number,
      	created_by_type: String,
      	date_created: Date,
      	status: String,
      	date_posted: Date,
      	posted_by: Number,
      	posted_by_type: String,
      	ran: String,
      	accepted: String,
      	date_accepted: Date,
      	date_opened: Date,
      	date_removed: Date
      }]
},
{collection:"quotes"});


quoteMongoSchema.methods.getAllWithHiredDates = function(query, selectedFields){

	var me = this;

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

	var jobOrderSchema = require("../models/JobOrder");
	var subcontractorSchema = require("../models/Subcontractor");

	var JobOrderModel = db.model("JobOrder", jobOrderSchema);
	var QuoteModel = db.model("QuoteModel", quoteMongoSchema);
	var Subcontractor = db.model("Subcontractor", subcontractorSchema);

	var JobOrderObj = new JobOrderModel();
	var SubcontractorObj = new Subcontractor();


	db.once('open', function () {
		QuoteModel.find(query).lean()
			.sort({
				date_quoted: -1
			}).exec(function (err, fetched_quotes) {
			if(err){
				console.log(err);
				willFulfillDeferred.resolve(null);
			}


			function fetchActualJo(i, j){
				var current_item = fetched_quotes[i];
				var fetchDefer = Q.defer();

				JobOrderObj.getOneByQuery(
					{
						tracking_code: current_item.quote_details[j].tracking_code,
						deleted:{
							$ne:true
						}
					},
					selectedFields
				).then(function(result){

					if(result){

						if(result.date_filled_up){
							result.date_filled_up = moment(result.date_filled_up).format("YYYY-MM-DD");
						}

						if(result.date_closed){
							result.date_closed = moment(result.date_closed).format("YYYY-MM-DD");
						}

						if(result.endorsed){
							if(result.endorsed.length > 0){
								result.endorsed.sort(function(a,b){
									// Turn your strings into dates, and then subtract them
									// to get a value that is either negative, positive, or zero.
									return new Date(a.date_created) - new Date(b.date_created);
								});

								result.date_first_endorsement = moment(result.endorsed[0].date_created).format("YYYY-MM-DD");

								result.days_between_jo_and_endorsement = business.weekDays(moment(result.date_filled_up), moment(result.date_first_endorsement))
							}

							delete result.endorsed;
						}

						result.quote_date = moment(current_item["date_quoted"]).format("YYYY-MM-DD");

						result.days_between_jo_and_quote = business.weekDays(moment(result.date_filled_up), moment(result.quote_date));


						result.quote_id = current_item["quote_id"];
						if(current_item["service_agreement"][0]){
							result.service_agreement_id = current_item["service_agreement"][0]["service_agreement_id"];
							result.service_agreement_date_created = moment(current_item["service_agreement"][0]["date_created"]).format("YYYY-MM-DD");

							result.days_between_quote_and_sa = business.weekDays(moment(result.quote_date), moment(result.service_agreement_date_created));

							if(current_item["service_agreement"][0]["date_accepted"]){
								result.service_agreement_date_accepted = moment(current_item["service_agreement"][0]["date_accepted"]).format("YYYY-MM-DD");
							}

							if(result.date_first_endorsement){
								if(result.date_closed){
									//did not push through
									result.days_between_endorsement_and_did_not_push_through = business.weekDays(moment(result.date_first_endorsement), moment(result.date_closed));
								} else{
									//sa
									result.days_between_endorsement_and_sa = business.weekDays(moment(result.date_first_endorsement), moment(result.service_agreement_date_created));
								}
							}


							Subcontractor.find({
								"service_agreement_details.service_agreement_id": parseInt(result.service_agreement_id)
							}).sort({
								"subcontractors_detail.starting_date": 1
							}).lean().exec(function (err, fetched_subcons) {
								if(err){
									console.log(err);
									fetchDefer.resolve(result);
								}

								if(fetched_subcons){
									if(fetched_subcons.length){
										result.subcontractors_hired = fetched_subcons.length;
										result.subcontractors_starting_date = moment(fetched_subcons[0].subcontractors_detail.starting_date).format("YYYY-MM-DD");

										result.days_between_sa_and_hired_start = business.weekDays(moment(result.service_agreement_date_created), moment(result.subcontractors_starting_date));

									}
								}

								fetchDefer.resolve(result);
							});
						} else{
							fetchDefer.resolve(result);
						}
					} else{
						fetchDefer.resolve(result);
					}


				});

				return fetchDefer.promise;
			}


			function fetchJo(i){
				var fetchDefer = Q.defer();

				var current_item = fetched_quotes[i];

				var all_fetch_jo_promises = [];

				for(var j = 0;j < current_item.quote_details.length;j++){
					all_fetch_jo_promises.push(fetchActualJo(i, j));
				}

				Q.allSettled(all_fetch_jo_promises).then(function(results){
					var jos = [];
					for(var i = 0;i < results.length;i++){
						if(results[i].value){
							var current_item = results[i].value;
							jos.push(current_item);
						}
					}
					fetchDefer.resolve(jos);
				});


				return fetchDefer.promise;
			}

			if(fetched_quotes){
				var all_fetch_promises = [];
				for(var i = 0;i < fetched_quotes.length;i++){
					all_fetch_promises.push(fetchJo(i));
				}

				Q.allSettled(all_fetch_promises).then(function(results){
					var jos = [];
					for(var i = 0;i < results.length;i++){
						var current_item = results[i];
						if(current_item.value.length > 0){
							jos.push(current_item.value[0]);
						}

					}
					db.close();
					willFulfillDeferred.resolve(jos);
				});
			} else{
				willFulfillDeferred.resolve(null);
			}

            //
            //
			// willFulfillDeferred.resolve(fetched_quotes);
		});
	});



	return willFulfill;
}


module.exports = quoteMongoSchema;
