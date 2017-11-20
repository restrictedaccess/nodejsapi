var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');

var swig  = require('swig');

var quoteSchema = require("../mysql/Quote");
var leadsInfoSchema = require("../mysql/Lead_Info");
var adminInfoSchema = require("../mysql/Admin_Info");
var personalInfoSchema = require("../mysql/Personal_Info");
var agentInfoSchema = require("../mysql/Agent_Info");
var quoteDetailSchema = require("../mysql/Quote_Details");
var currencyLookupSchema = require("../mysql/Currency_Lookup");
var currentCurrencySchema = require("../mysql/Current_Currency");
var SAschema = require("../mysql/ServiceAgreement");
var saDetails = require("../mysql/SADetails");
var timezoneSchema = require("../mysql/TimeZone");
var rsContactSchema = require("../mysql/Rs_Contact");
var quoteHistorySchema = require("../mysql/Quote_History");
var quoteComponent = require("../components/Quote");
var jobOrderSchema = require("../models/JobOrder");
var quoteMongoSchema = require("../models/QuoteModel");
var moment = require('moment');
var moment_tz = require('moment-timezone');
//var quoteQueue = require("../bull/Que_Quote");

var data_result={};
var data_res_pInfodetails=[];
var work_status_description="With 1 hour break";
var num_hrs=8.0;
var result="";
var today = new Date();

var http = require("http");
http.post = require('http-post');

today = today.toISOString().slice(0,10);

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

//Get Leads generated quotes
router.get("/get-leads-quote", function(req,res,next){

	quoteSchema.getQuotebyLead(req.query).then(function(objectresult){
		//console.log(objectresult);

		data_result = {
			"result" : "OK",
			"data" : []
		};

		function dataPusherQuote(i){

			if(i < objectresult.length)
			{
				item = objectresult[i];
				quoteComponent.whosThis(item.created_by,item.created_by_type).then(function(data_whos){

					if(req.query.status == "no" || req.query.status == "yes" )
					{


						if(item.created_by_type=="admin")
						{
							data_result.data.push({

								id: item.id,
								status:item.status,
								date_created: item.date_quoted,
								date_posted: item.date_posted,
								created_by:{
									admin_fname: data_whos.admin_fname,
									admin_lname: data_whos.admin_lname,
									admin_email: data_whos.admin_email,
									signature_no: data_whos.signature_contact_nos,
									signature_company: data_whos.signature_company
								},
								service_agreement_id:item.service_agreement_id,
								details:item


							});
						}
						else
						{
							data_result.data.push({

								id: item.id,
								status:item.status,
								date_created: item.date_quoted,
								date_posted: item.date_posted,
								created_by:{
									admin_fname: data_whos.admin_fname,
									admin_lname: data_whos.admin_lname,
									admin_email: data_whos.admin_email,
									signature_no:"",
									signature_company:""
								},
								service_agreement_id:item.service_agreement_id,
								details:item


							});
						}





					}
					else
					{
						data_result.data.push({

							id: item.id,
							status: item.status,
							date_created: item.date_quoted,
							date_posted: item.date_posted,
							created_by:{
								admin_fname: data_whos.admin_fname,
								admin_lname: data_whos.admin_lname,
								admin_email: data_whos.admin_email
							}


						});
					}


					dataPusherQuote(i+1)


				});

			}
			else
			{
				return res.send(data_result);
			}

		}

		dataPusherQuote(0);


	}).catch(function(err){

		result = {
			success:false,
			msg : err+ "Quote by Lead"
		};
		res.send(result, 200);

	});


});


router.post("/generate-quote", function(req,res,next){
//Use quoteComponent for extended functions
	var hash = quoteComponent.generateHash(50);//generate hash
	var created_by = req.body.created_by;
	var created_by_type = req.body.created_by_type;
	var leads_id = req.body.leads_id;


	req.body.ran = hash;

	//insert data to quote's table
	quoteSchema.insertQuote(req.body).then(function(data){



		leadsInfoSchema.updateLeads(data.leads_id).then(function(data2){

			result = {
				success:true,
				data:data2,
				quote_id:data.id
			};



			quoteComponent.addHistory(created_by,data.id,"",'INSERT');
			return res.send(result, 200);

		}).catch(function(err){

			result = {
				success:false,
				msg : err+ "Update Leads Table"
			};
			res.send(result, 200);

		});


	}).catch(function(err){

		result = {
			success:false,
			msg : err+ "Insert Quotes Table"
		};
		res.send(result, 200);

	});
	//
});


//get all leads with quote
router.get("/get-all-leads", function(req,res,next){

	var leads_id = (typeof req.query.leads_id != "undefined" ? req.query.leads_id  : null);
	var page = (req.query.page ? req.query.page : 1);
	var isCount = (req.query.count ? req.query.count : "no");
	var pageLimit = 50;


	if(!page)
	{
		var result = {
			success:false,
			msg:"No Page number request"
		}
		return res.status(200).send(result);
	}


	var countPromise = leadsInfoSchema.countData(leads_id);
	var promise = [];
	var output = [];
	var pageCount = null;

	var params = {page:page,limit:pageLimit,leads_id:leads_id};

	function delay() {
		return Q.delay(100);
	}


	if(isCount == 'yes')
	{
		console.log(isCount);
		countPromise.then(function(count){
			pageCount = count;
			getLeadsData(true);

		}).catch(function (err) {
			var result = {
				success:false,
				msg:err
			}
			return res.status(200).send(result);
		});
	}
	else
	{
		getLeadsData(true);
	}


	function getLeadsData(isRun)
	{
		if(isRun)
		{

			var getLeadsDataPromise = leadsInfoSchema.getOffsetLeadsData(params);
			getLeadsDataPromise.then(function(leads_data){

				if(leads_data)
				{
					if(leads_data.length > 0) {


						for (var i = 0; i < leads_data.length; i++) {
							item = leads_data[i];

							var per_leads_promise = [];
							item.sync = false;
							var quote_promise = item.getQuoteMongo();

							per_leads_promise.push(quote_promise);
							per_leads_promise.push(delay);

							per_leads_promises_promise = Q.allSettled(per_leads_promise);
							promise.push(per_leads_promises_promise);
							promise.push(delay);
						}

					}else
					{
						var per_leads_promise = [];
						var quote_promise = leads_data.getQuoteMongo();

						per_leads_promise.push(quote_promise);
						per_leads_promise.push(delay);

						per_leads_promises_promise = Q.allSettled(per_leads_promise);
						promise.push(per_leads_promises_promise);
						promise.push(delay);
					}

					var allPromise = Q.all(promise);
					allPromise.then(function (results) {

						if (leads_data.length > 0) {

							function getLead(x) {
								if (x < leads_data.length) {
									item_leads = leads_data[x];
									output.push(item_leads.structLeadsData());
									getLead(x + 1);
								}
								else {
									getLeadsData(false);
								}
							}

							getLead(0);
						}
						else
						{
							output.push(leads_data.structLeadsData());
							getLeadsData(false);
						}
					});
				}
				else
				{
					var result = {
						success:false,
						data:null
					}
					return res.status(200).send(result);
				}
			});
		}else
		{
			var result = {
				success:true,
				data:output,
				totalCount:pageCount
			}
			return res.status(200).send(result);
		}
	}

});




//Leads Currency Setting
router.get("/show", function(req,res,next){

	var quote_id = req.query.id;
	data_result={};
	data_res=[];
	data_res_pInfodetails=[];
	dataSA=[];
	var posted_accepted_service_agreements=[];
	var isLocked = false;

	quoteSchema.getLeadsID(quote_id,null).then(function(objectresult){
		//get lead_info

		leadsInfoSchema.getLeadsInfo(objectresult.leads_id).then(function(objectresult2){
			//get admin_info

			adminInfoSchema.getAdminInfo(objectresult.created_by).then(function(objectresult3){
				//get quote details

				quoteDetailSchema.getQuoteDetails(quote_id).then(function(objectresult4){

					function dataPusherDetails(i){

						if(i < objectresult4.length)
						{
							item = objectresult4[i];



							if(item.work_status == "Part-Time")
							{
								work_status_description = "No break";
								num_hrs = 4.0;
							}

							//quoted_price breakdown
							var yearly = parseFloat(item.quoted_price * 12.0);
							var monthly = parseFloat(item.quoted_price);
							var weekly = yearly / 52.0;
							var daily = weekly / 5.0;
							var hourly = parseFloat(daily) / num_hrs;
							var work_start_str="";
							var work_finish_str="";
							var client_start_work_hour_str="";
							var client_finish_work_hour_str="";


							// if(item.work_start)
							// {
							// 	work_start_str = phpdate("g:i A", ((today,item.work_start)/1000));
							// }
							// if(item.work_finish)
							// {
							// 	work_finish_str = phpdate("g:i A", ((today,item.work_start)/1000));
							// }
							// if(item.client_start_work_hour)
							// {
							// 	client_start_work_hour_str = phpdate("g:i A", ((today,item.client_start_work_hour)/1000));
							// }
							//
							// if(item.client_finish_work_hour)
							// {
							// 	client_finish_work_hour_str = phpdate("g:i A", ((today,item.client_finish_work_hour)/1000));
							// }



							if(item.userid){
								personalInfoSchema.getPersonalInfo(item.userid).then(function(objectresult6){

									if(objectresult6){

										data_res_pInfodetails.push({

											id: item.id,
											quote_id: item.quote_id,
											work_position: item.work_position,
											userid: item.userid,
											salary: item.salary,
											client_timezone: item.client_timezone,
											client_start_work_hour: item.client_start_work_hour,
											client_finish_work_hour: item.client_finish_work_hour,
											lunch_start: item.lunch_start,
											lunch_out: item.lunch_out,
											lunch_hour: item.lunch_hour,
											work_start: item.work_start,
											work_finish: item.work_finish,
											working_hours: item.working_hours,
											days: item.days,
											quoted_price: item.quoted_price,
											work_status: item.work_status,
											currency: item.currency,
											work_description: item.work_description,
											notes: item.notes,
											currency_fee: item.currency_fee,
											currency_rate: item.currency_rate,
											gst: item.gst,
											no_of_staff: item.no_of_staff,
											quoted_quote_range: item.quoted_quote_range,
											staff_country: item.staff_country,
											staff_timezone: item.staff_timezone,
											staff_currency: item.staff_currency,
											detail_status:  item.detail_status,
											starting_date: item.starting_date,
											work_start_str : work_start_str,
											work_finish_str : work_finish_str,
											client_start_work_hour_str : client_start_work_hour_str,
											client_finish_work_hour_str : client_finish_work_hour_str,
											tracking_code: item.tracking_code,
											service_fee: item.service_fee,
											office_fee: item.office_fee,
											currency_adjustment: item.currency_adjustment,
											others: item.others,
											others_description: item.others_description,
											gst_apply: item.gst_apply,
											special_arrangement_description: item.special_arrangement_description,
											special_arrangement_work_status: item.special_arrangement_work_status,
											special_arrangement_working_days: item.special_arrangement_working_days,
											special_arrangement_working_hrs: item.special_arrangement_working_hrs,
											special_arrangement_approval: item.special_arrangement_approval,
											client_work_start : item.client_work_start,
											staff_work_start : item.staff_work_start,
											client_work_finish : item.client_work_finish,
											staff_work_finish : item.staff_work_finish,
											work_status_index : item.work_status_index,
											margin : item.margin,
											selected_start_work :item.selected_start_work,
											candidate:{
												fname: objectresult6.fname,
												lname: objectresult6.lname,
												email: objectresult6.email,
												id: item.userid,
												type: "personal"
											},
											// sign: objectresult5.sign,
											work_status_description: work_status_description,
											quoted_price_breakdown:
											{
												yearly: quoteComponent.number_format(yearly, 2, ".", ","),
												monthly: quoteComponent.number_format(monthly, 2, ".", ","),
												weekly: quoteComponent.number_format(weekly, 2, ".", ","),
												daily: quoteComponent.number_format(daily, 2, ".", ","),
												hourly: quoteComponent.number_format(hourly, 2, ".", ","),
											},
											total_price:quoteComponent.number_format( ( ( item.quoted_price * item.no_of_staff ) + item.gst  ) , 2, ".", ",")

										});



										dataPusherDetails(i+1);
									}
								}).catch(function(err){
									result = {
										success:false,
										msg : err+ "getpersonalInfo"
									};
									res.send(result, 200);
								});
							}
							else
							{

								data_res_pInfodetails.push({
									id: item.id,
									quote_id: item.quote_id,
									work_position: item.work_position,
									userid: item.userid,
									salary: item.salary,
									client_timezone: item.client_timezone,
									client_start_work_hour: item.client_start_work_hour,
									client_finish_work_hour: item.client_finish_work_hour,
									lunch_start: item.lunch_start,
									lunch_out: item.lunch_out,
									lunch_hour: item.lunch_hour,
									work_start: item.work_start,
									work_finish: item.work_finish,
									working_hours: item.working_hours,
									days: item.days,
									quoted_price: item.quoted_price,
									work_status: item.work_status,
									currency: item.currency,
									work_description: item.work_description,
									notes: item.notes,
									currency_fee: item.currency_fee,
									currency_rate: item.currency_rate,
									gst: item.gst,
									no_of_staff: item.no_of_staff,
									quoted_quote_range: item.quoted_quote_range,
									staff_country: item.staff_country,
									staff_timezone: item.staff_timezone,
									staff_currency: item.staff_currency,
									detail_status:  item.detail_status,
									starting_date: item.starting_date,
									work_start_str : work_start_str,
									work_finish_str : work_finish_str,
									client_start_work_hour_str : client_start_work_hour_str,
									client_finish_work_hour_str : client_finish_work_hour_str,
									tracking_code: item.tracking_code,
									service_fee: item.service_fee,
									office_fee: item.office_fee,
									currency_adjustment: item.currency_adjustment,
									others: item.others,
									others_description: item.others_description,
									gst_apply: item.gst_apply,
									special_arrangement_description: item.special_arrangement_description,
									special_arrangement_work_status: item.special_arrangement_work_status,
									special_arrangement_working_days: item.special_arrangement_working_days,
									special_arrangement_working_hrs: item.special_arrangement_working_hrs,
									special_arrangement_approval: item.special_arrangement_approval,
									client_work_start : item.client_work_start,
									staff_work_start : item.staff_work_start,
									client_work_finish : item.client_work_finish,
									staff_work_finish : item.staff_work_finish,
									work_status_index : item.work_status_index,
									margin : item.margin,
									selected_start_work :item.selected_start_work,
									quoted_price_breakdown:
									{
										yearly: quoteComponent.number_format(yearly, 2, ".", ","),
										monthly: quoteComponent.number_format(monthly, 2, ".", ","),
										weekly: quoteComponent.number_format(weekly, 2, ".", ","),
										daily: quoteComponent.number_format(daily, 2, ".", ","),
										hourly: quoteComponent.number_format(hourly, 2, ".", ","),
									},
									total_price:quoteComponent.number_format( ( ( item.quoted_price * item.no_of_staff ) + item.gst  ) , 2, ".", ",")


								});

								dataPusherDetails(i+1);
							}

						}
						else
						{
							//return res.send(data_res_pInfodetails);
							//get service agreement

							SAschema.getServiceAgreement(quote_id).then(function(data){
								// return res.status(200).send(data);
								var total=0;
								function SAdetails(x){
									saItem = data[x];


									if(x < data.length)
									{

										if(saItem.status == "posted")
										{
											if(saItem.accepted == "yes")
											{
												posted_accepted_service_agreements[x] = data[x];
											}
										}
										if(saItem.status == "posted"|| saItem.status == "new")
										{
											parseInt(total=total+1);
										}
										quoteComponent.whosThis(saItem.created_by,saItem.created_by_type).then(function(data_whos){

											dataSA.push({


												id: saItem.service_agreement_id,
												status: saItem.status,
												date_created: saItem.date_created,
												date_posted: saItem.date_posted,
												accepted: saItem.accepted,
												date_accepted: saItem.date_accepted,
												date_removed: saItem.date_removed,
												ran: saItem.ran,
												created_by:data_whos


											});


											SAdetails(x+1);
										});



									}else
									{



										if((objectresult.status == "posted" || objectresult.status == "accepted") && posted_accepted_service_agreements.length > 0 )
										{
											isLocked = true;
										}
										else
										{
											isLocked = false;
										}

										quoteComponent.whosThis(objectresult2.hiring_coordinator_id,"admin").then(function(data_whos) {


											data_result = {
												"result" : "OK",
												"data" : {
													id : quote_id,
													leads_id : objectresult.leads_id,
													created_by : objectresult.created_by,
													created_by_type : objectresult.created_by_type,
													status: objectresult.status,
													quote_no:quote_id,
													date_quoted: objectresult.date_quoted,
													date_posted: objectresult.date_posted,
													locked: isLocked,
													ran:objectresult.ran,
													client:{
														id:objectresult.leads_id,
														type:"leads",
														fname: objectresult2.fname,
														lname: objectresult2.lname,
														email: objectresult2.email,
														mobile: objectresult2.mobile,
														company_name: objectresult2.company_name,
														company_address: objectresult2.company_address,
														hiring_coordinator:data_whos
													},

													quoted_by:{
														id:objectresult.created_by,
														type:objectresult.created_by_type,
														admin_fname: objectresult3.admin_fname,
														admin_lname: objectresult3.admin_lname,
														admin_email: objectresult3.admin_email,
														signature_no: objectresult3.signature_contact_nos,
														signature_company: objectresult3.signature_company
													},
													quote_details:data_res_pInfodetails,
													service_agreements:dataSA,
													posted_accepted_service_agreements:posted_accepted_service_agreements,
													totalSA:total
												}
											};



											return res.send(data_result);


										});



									}

								}

								SAdetails(0);

								//return res.send(data);

							});

							//return res.send(data_result);
						}

					}

					dataPusherDetails(0);


				}).catch(function(err){

					result = {
						success:false,
						msg : err+ "getQuoteDetails"
					};
					res.send(result, 200);

				});


			}).catch(function(err){

				result = {
					success:false,
					msg : err+ "getAdminInfo"
				};
				res.send(result, 200);

			});



		}).catch(function(err){

			result = {
				success:false,
				msg : err+ "getLeadsInfo"
			};
			res.send(result, 200);

		});




	}).catch(function(err){

		result = {
			success:false,
			msg : err+ "getLeadsID"
		};
		res.send(result, 200);

	});

});

router.get("/get-timezone", function(req,res,next){

	timezoneSchema.getTimezone().then(function(data){


		var result = {
			success:true,
			data:data
		}

		return res.status(200).send(result);

	}).catch(function(err){
		var result = {
			success:false,
			data:null
		}

		return res.status(200).send(result);
	});


});


router.get("/get-job-order", function(req,res,next){
	var JobOrder = mongoose.model("JobOrder", jobOrderSchema);

	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;

	if(req.query.tracking_code)
	{
		var search_key = {leads_id:parseInt(req.query.leads_id),tracking_code:req.query.tracking_code,
			order_status:"Open",job_title:{'$ne':'TBA When JS is Filled'}};

	}else
	{
		var search_key = {leads_id:parseInt(req.query.leads_id),order_status:"Open",
			job_title:{'$ne':'TBA When JS is Filled'}};
	}

	try
	{
		getJobOrder();
	}
	catch(err)
	{
		db.close();
		console.log(err);
	}


	function getJobOrder()
	{
		db.once('open', function(){

			JobOrder.find(search_key).exec(function(err, data){

				db.close();

				return res.send(data);

			}).catch(function(err){
				db.close();
				return res.send(err);

			});

		});
	}


});


router.post("/add-quote-details", function(req,res,next){

	var timeArray_display = [ "1:00 am","1:30 am","2:00 am","2:30 am","3:00 am","3:30 am","4:00 am","4:30 am","5:00 am","5:30 am","6:00 am","6:30 am","7:00 am","7:30 am", "8:00 am","8:30 am",
		"9:00 am","09:30 am", "10:00 am","10:30 am", "11:00 am", "11:30 am", "12:00 noon", "12:30 pm", "1:00 pm", "1:30 pm","2:00 pm", "2:30 pm","3:00 pm","3:30 pm", "4:00 pm","4:30 pm", "5:00 pm",
		"5:30 pm", "6:00 pm", "6:30 pm","7:00 pm","7:30 pm","8:00 pm","8:30 pm","9:00 pm","9:30 pm","10:00 pm","10:30 pm","11:00 pm","11:30 pm","12:00 midnight", "12:30 am"];

	var workValue =  ["Full-Time","Part-Time","Full-Time","Part-Time","Full-Time","Part-Time","Part-Time"];


	req.body.working_hours = 8;
	req.body.gst_value = 0;
	req.body.no_of_staff = 1;
	req.body.days  =5;
	req.body.work_status_index = req.body.work_status;
	var temp = req.body.tracking_code.split("_");
	req.body.tracking_code = temp[0];

	//client
	req.body.client_work_start = timeArray_display[req.body.work_start];
	req.body.client_work_finish = req.body.work_finish;
	//client start_work_hr
	var c_h_s = timeArray_display[req.body.work_start].split(":");
	var c_h_sVal = c_h_s[0];
	req.body.client_start_work_hour=c_h_sVal;
	//client finish_work_hr
	var c_h_f = req.body.work_finish.split(":");
	var c_h_fVal = c_h_f[0];
	req.body.client_finish_work_hour=c_h_fVal;


	//staff
	req.body.staff_work_start = timeArray_display[req.body.work_start_staff];
	req.body.staff_work_finish = req.body.work_finish_staff;
	//staff start work
	var s_h_s = timeArray_display[req.body.work_start_staff].split(":");
	var s_h_sVal = s_h_s[0];
	req.body.work_start_staff = s_h_sVal;
	//staff finish work
	var s_h_s = req.body.work_finish_staff.split(":");
	var s_h_sVal = s_h_s[0];
	req.body.work_finish_staff = s_h_sVal;


	var status =  req.body.work_status;
	req.body.work_status = workValue[req.body.work_status];

	if(req.body.work_status == "Part-Time")
	{
		req.body.working_hours = 4;
	}

	if(req.body.apply_gst == 'Yes')
	{
		req.body.gst_value = (parseFloat(req.body.quoted_price) * .10);
	}


	if(status == "0")
	{
		req.body.work_description = "Full Time with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
	}
	else if(status == "1")
	{
		req.body.work_description = "Part Time no lunch break 4hours a day, 5 days a week Monday to Friday";
	}
	else if(status == "2")
	{
		req.body.work_description = "Full Time 1 Week Trial with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
	}
	else if(status == "3")
	{
		req.body.work_description = "Part time 1 Week Trial no lunch break 4hours a day, 5days a week Monday to Friday";
	}
	else if(status == "4")
	{
		req.body.work_description = "Full Time 2 Week Trial with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
	}
	else if(status == "5")
	{
		req.body.work_description = "Part time 2 Week Trial no lunch break 4hours a day, 5days a week Monday to Friday";
	}
	else if(status == "6")
	{
		req.body.work_description = "Special Arrangement - "+req.body.specialArrangement+" "+req.body.specialArrangement_requiredHours+"hour(s) a day,"+req.body.specialArrangement_workingDays+"day(s) a week.- "+req.body.work_status_special;
	}
	else
	{
		req.body.work_description = "";
	}



	quoteDetailSchema.addQuoteDetails(req.body).then(function(data){


		if(data.id)
		{
			quoteSchema.updateQuote(req.body).then(function(result){


				result = {
					success:true,
					data: result,
					lastId:data.id
				};

				return res.send(result,200);

			});
		}


	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};

	});


	//apply_gst
	//client_timezone
	//currency//
	//currency_adjustment
	//lanceApproval
	//margin
	//office_fee
	//others_amount
	//others_description
	//quote_id
	//quoted_price
	//salary
	//service_fee
	//specialArrangement
	//specialArrangement_requiredHours
	//specialArrangement_workingDays
	//staff_currency
	//staff_timezone
	//work_finish
	//work_finish_staff
	//work_position
	//work_start
	//work_start_staff
	//work_status
	//work_status_special


	//return res.send(req.body, 200);

});

router.post("/update-quote", function(req,res,next){


	if(!req.body.detail_status)
	{
		var timeArray_display = [ "1:00 am","1:30 am","2:00 am","2:30 am","3:00 am","3:30 am","4:00 am","4:30 am","5:00 am","5:30 am","6:00 am","6:30 am","7:00 am","7:30 am", "8:00 am","8:30 am",
			"9:00 am","09:30 am", "10:00 am","10:30 am", "11:00 am", "11:30 am", "12:00 noon", "12:30 pm", "1:00 pm", "1:30 pm","2:00 pm", "2:30 pm","3:00 pm","3:30 pm", "4:00 pm","4:30 pm", "5:00 pm",
			"5:30 pm", "6:00 pm", "6:30 pm","7:00 pm","7:30 pm","8:00 pm","8:30 pm","9:00 pm","9:30 pm","10:00 pm","10:30 pm","11:00 pm","11:30 pm","12:00 midnight", "12:30 am"];

		var workValue =  ["Full-Time","Part-Time","Full-Time","Part-Time","Full-Time","Part-Time","Part-Time"];



		req.body.working_hours = 8;
		req.body.gst_value = 0;
		req.body.no_of_staff = 1;
		req.body.days  =5;
		req.body.work_status_index = req.body.work_status;
		var temp = req.body.tracking_code.split("_");
		req.body.tracking_code = temp[0];

		//client
		req.body.client_work_start = timeArray_display[req.body.work_start];
		req.body.client_work_finish = req.body.work_finish;
		//client start_work_hr
		var c_h_s = timeArray_display[req.body.work_start].split(":");
		var c_h_sVal = c_h_s[0];
		req.body.client_start_work_hour=c_h_sVal;
		//client finish_work_hr
		var c_h_f = req.body.work_finish.split(":");
		var c_h_fVal = c_h_f[0];
		req.body.client_finish_work_hour=c_h_fVal;


		//staff
		req.body.staff_work_start = timeArray_display[req.body.work_start_staff];
		req.body.staff_work_finish = req.body.work_finish_staff;
		//staff start work
		var s_h_s = timeArray_display[req.body.work_start_staff].split(":");
		var s_h_sVal = s_h_s[0];
		req.body.work_start_staff = s_h_sVal;
		//staff finish work
		var s_h_s = req.body.work_finish_staff.split(":");
		var s_h_sVal = s_h_s[0];
		req.body.work_finish_staff = s_h_sVal;


		var status =  req.body.work_status;
		req.body.work_status = workValue[req.body.work_status];

		if(req.body.work_status == "Part-Time")
		{
			req.body.working_hours = 4;
		}

		if(req.body.apply_gst == 'Yes')
		{
			req.body.gst_value = (parseFloat(req.body.quoted_price) * .10);
		}


		if(status == "0")
		{
			req.body.work_description = "Full Time with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
		}
		else if(status == "1")
		{
			req.body.work_description = "Part Time no lunch break 4hours a day, 5 days a week Monday to Friday";
		}
		else if(status == "2")
		{
			req.body.work_description = "Full Time 1 Week Trial with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
		}
		else if(status == "3")
		{
			req.body.work_description = "Part time 1 Week Trial no lunch break 4hours a day, 5days a week Monday to Friday";
		}
		else if(status == "4")
		{
			req.body.work_description = "Full Time 2 Week Trial with 1hour lunch break 8hours a day, 5 days a week Monday to Friday";
		}
		else if(status == "5")
		{
			req.body.work_description = "Part time 2 Week Trial no lunch break 4hours a day, 5days a week Monday to Friday";
		}
		else if(status == "6")
		{
			req.body.work_description = "Special Arrangement - "+req.body.specialArrangement+" "+req.body.specialArrangement_requiredHours+"hour(s) a day,"+req.body.specialArrangement_workingDays+"day(s) a week.- "+req.body.work_status_special;
		}
		else
		{
			req.body.work_description = "";
		}
	}
	//return res.send(req.body.details,200);

	if(req.body.details)
	{
		var margins = ["","w/ Margin","w/o Margin","Custom Margin"];
		req.body.deleteDesc = "Job Order =>"+req.body.details.tracking_code+"_"+req.body.details.work_position+"<br>"
			+"Candidate =>"+req.body.details.userid+"<br>"
			+"Job Title =>"+req.body.details.work_position+"<br>"
			+"Work Status =>"+req.body.details.work_status+"<br>"
			+"Selected Start Date =>"+req.body.selected_start_date+"<br>"
			+"Client Timeznone =>"+req.body.details.client_timezone+"<br>"
			+"Client Start Work =>"+req.body.details.client_work_start+"<br>"
			+"Client Finish Work =>"+req.body.details.client_work_finish+"<br>"
			+"Staff Timezone =>"+req.body.details.staff_timezone+"<br>"
			+"Staff Start Work =>"+req.body.details.staff_work_start+"<br>"
			+"Staff Finish Work =>"+req.body.details.staff_work_finish+"<br>"
			+"Staff Currency =>"+req.body.details.staff_currency+"<br>"
			+"Salary =>"+req.body.details.salary+"<br>"
			+"Client Price =>"+req.body.details.quoted_price+"<br>"
			+"Currency Fluctuation =>"+req.body.details.currency_adjustment+"<br>"
			+"Adjusted currency =>"+req.body.details.currency_adjustment+"<br>"
			+"Client Currency =>"+req.body.details.currency+"<br>"
			+"GST =>"+req.body.details.gst_apply+"<br>"
			+"Margin =>"+margins[req.body.details.margin]+"<br>";

		if(req.body.details.office_fee)
		{
			req.body.deleteDesc += "Office Fee =>"+req.body.details.office_fee+"<br>";
		}
		if(req.body.details.service_fee)
		{
			req.body.deleteDesc += "Office Fee =>"+req.body.details.service_fee+"<br>";
		}
		if(req.body.details.special_arrangement_description)
		{
			req.body.deleteDesc += "Special Agreement Status =>"+req.body.details.special_arrangement_description+"<br>"
				+"Special Agreement Work Status =>"+req.body.details.special_arrangement_work_status+"<br>"
				+"Special Agreement Working Days =>"+req.body.details.special_arrangement_working_days+"<br>"
				+"Special Agreement Working Hours =>"+req.body.details.special_arrangement_working_hrs+"<br>"
				+"Special Agreement Approval =>"+req.body.details.special_arrangement_approval+"<br>";
		}

		if(req.body.details.others)
		{
			req.body.deleteDesc += "Office Miscellaneous =>"+req.body.details.others+"<br>"
				+"Office Miscellaneous Description =>"+req.body.details.others_description+"<br>";
		}

		req.body.quote_id =req.body.details.quote_id;
	}


	quoteDetailSchema.updateQuoteDetails(req.body).then(function(data){


		result = {
			success:true,
			data: data
		};

		return res.send(result,200);

	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};

	});
});



router.post("/search-main", function(req,res,next){

	quoteSchema.searchLead(req.body).then(function(searchdata){

		result = {
			success:true,
			data: searchdata
		};
		return res.send(result, 200);

	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};
		return res.send(result, 200);;
	});


});


router.post("/get-staff-salary", function(req,res,next){


	quoteSchema.getStaffSalary(req.body).then(function(price){

		result = {
			success:true,
			data: price[0]
		};
		return res.send(result, 200);


	}).catch(function(err){

		result = {
			success:false,
			msg: err.toString()
		};
		return res.send(result, 200);;
	});
});

router.get("/get-lead-info",function(req,res,next){

	leadsInfoSchema.getLeadsInfo(req.query.id).then(function(data){


		result = {
			success:true,
			data: data
		};
		return res.send(result, 200);


	}).catch(function(){

		result = {
			success:true,
			data: price[0]
		};
		return res.send(result, 200);
	});
});




router.get("/sync-quote",function(req,res,next){



	// quoteSchema.dataForSync(0).then(function(data){
	//
	// 	console.log(data.id);
	//
	// });



	//getTotal page
	quoteSchema.getTotalQuote().then(function(total){

		console.log("Total number of quote records #"+total.count);


		//quoteQueue.processJobIndexAll(total.count);


	}).catch(function(){

		console.log(err+" Error getting total Pages");
	});
});

router.get("/get-current-currency",function(req,res,next){

	currentCurrencySchema.getCurrentCurrency().then(function(data){


		result = {
			success:true,
			data: data
		};
		return res.status(200).send(result);


	}).catch(function(err){

		return res.status(200).send(err);

	});


});

router.get("/get-quoteid",function(req,res,next){


	SAschema.getQuoteIDbyRAN(req.query.ran).then(function(data){
		// quoteSchema.getQuoteID(req.query.ran).then(function(data){

		result = {
			success:true,
			data: data
		};
		return res.send(result, 200);

	}).catch(function(err){

		result = {
			success:false,
		};
		return res.send(result, 200);

	});


});

router.get("/get-rs-contact",function(req,res,next){

	rsContactSchema.getrsContact().then(function(data){

		result = {
			success:true,
			data: data
		};
		return res.send(result, 200);

	}).catch(function(err){

		result = {
			success:false,
		};
		return res.send(result, 200);

	});


});

router.get("/get-quote-history",function(req,res,next){


	getHistory = [];

	quoteHistorySchema.getHistory(req.query.quote_id).then(function(data){




		function getName(i)
		{
			if(i < data.length) {
				item = data[i];

				quoteComponent.whosThis(item.created_by, "admin").then(function (data_whos) {
					getHistory.push({

						created_by: item.created_by,
						admin_fname: data_whos.admin_fname,
						admin_lname: data_whos.admin_lname,
						action: item.action,
						description:item.description,
						date_created: item.date_created

					});


					getName(i+1);
				}).catch(function(err){

					result = {
						success:false,
						data:err
					};
					return res.send(result, 200);

				});;
			}
			else
			{

				result = {
					success:true,
					data:getHistory
				};


				return res.send(result, 200);
			}


		}




		getName(0);

	}).catch(function(err){

		result = {
			success:false,
			data:err
		};
		return res.send(result, 200);

	});

});


router.post("/delete-quote",function(req,res,next){


	quoteSchema.updateQuote(req.body).then(function(result){

		result = {
			success:true,
			data: result
		};

		quoteComponent.addHistory(req.body.adminID,req.body.quote_id,"",'DELETE QUOTE');
		return res.send(result,200);

	});


});



router.get("/convert-quote-SA",function(req,res,next){

	return res.send("Hello");

});

router.get("/get-sa-details",function(req,res,next){

	var sa_id = req.query.sa_id;

	saDetails.getServiceAgreementDetails(sa_id).then(function(data){

		result = {
			success:true,
			data: data
		};

		return res.send(result,200);
	});
});

router.get("/accept-quote",function(req,res,next){

	quoteSchema.acceptQuote(req.query.id).then(function(result){

		result = {
			success:true,
			data: result
		};
		return res.send(result,200);
	});
});


router.post("/accept-sa",function(req,res,next){


	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();

	//quoteComponent.attachPdf(quoteComponent.getCouchID(doc),req.body.pdf_file);
	var pdf_name="Service_Agreement_Final_V"+(moment(added_on).year())+"-"+(moment(added_on).month()+1)
		+"-"+(moment(added_on).date())+"_"+(moment(added_on).hour())+"-"+(moment(added_on).minute())+"-"+(moment(added_on).second())+".pdf";

	var doc = {
		date_accepted : [moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()],
		filename:pdf_name,
		generated_by : "NODEJS/quote/accept-sa/",
		leads_id : req.body.client_id,
		service_agreement_id : req.body.sa_id,
		version:[moment(added_on).year(), moment(added_on).month()+1, moment(added_on).date(), moment(added_on).hour(), moment(added_on).minute(), moment(added_on).second()]
	};





	SAschema.acceptServiceAgreement(req.body.sa_id).then(function(result){

		quoteComponent.getCouchID(doc,false).then(function(couch_id){

			quoteComponent.attachPdf(couch_id,req.body.pdf_file).then(function(pdf_name){

				result = {
					success:true,
					data: result,
					id:couch_id,
					pdf:pdf_name
				};


				quoteComponent.addHistory(req.body.created_by,req.body.sa_id,req.body.quote_id,'ACCEPT');

				return res.send(result,200);
			});

		});

	});


	// http.post(apiUrl+"/activate-prepaid-contract/accept-service-agreement/",
	// 	{service_agreement_id:req.body.sa_id},
	// 	function(res){
	// 		res.setEncoding('utf8');
	// 		res.on('data', function (body) {
	// 			console.log('Body: ' + body);
	// 		});
	// 	});


});

router.post("/update-quote-status",function(req,res,next){

	quoteSchema.updateQuote(req.body).then(function(result){

		result = {
			success:true,
			data: result
		};



		if(req.body.status == 'posted')
		{
			quoteComponent.addHistory(req.body.created_by,req.body.sa_id,req.body.quote_id,'CONVERT');
		}

		return res.send(result,200);

	});


});


router.post("/convert-sa",function(req,res,next){

	var quote_id = req.body.quote_id;
	var admin_id = req.body.admin_id;
	var type = req.body.type;



	return res.send(req.body);

});


router.post("/get-emailTemplate",function(req,res,next){

	result = {};

	var template = swig.compileFile(configs.getEmailTemplatesPath() + '/service_agreement/email_template.html');

	var output = template({
		temp : req.body
	});

	if(output)
	{
		result = {
			success:true,
			data: output
		};
	}

	return res.send(result,200);

});


router.post("/get-sa-ran",function(req,res,next){


	SAschema.getRanBySA(req.body.sa_id).then(function(resultFound){

		result = {
			success:true,
			data:resultFound
		};

		return res.send(result, 200);

	}).catch(function(err){

		result = {
			success:false,
			data:err
		};

		return res.send(result, 200);

	});

});

router.get("/lead-counter",function(req,res,next){



	leadsInfoSchema.countAllLeads(null).then(function(resultFound){

		result = {
			success:true,
			data:resultFound.count
		};

		return res.send(result, 200);

	}).catch(function(err){
		result = {
			success:false,
			data:err
		};

		return res.send(result, 200);
	});
});


module.exports = router;
