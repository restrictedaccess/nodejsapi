var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');

//import ClientsSchema
var staffSchema = require("../models/Staff");

var mongoCredentials = configs.getMongoCredentials();


/*
 * Method in showing candidate basic info
 * @url http://test.njs.remotestaff.com.au/staff/get-staff-info/?id=74
 * @param int id 
 */
router.get("/get-staff-info", function(req,res,next){
	var Staff = mongoose.model("Staff", staffSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	db.once('open', function(){
		Staff.findOne({userid:id}).exec(function(err, staff){
			
			db.close();			
			var result = {
				success:true, 
				result : {
					fname : staff.candidate_details.fname,
					lname : staff.candidate_details.lname,
					email : staff.candidate_details.email,
				}
			};		
			return res.send(result, 200);
			
		});
	});
});


/*
 * Method in getting candidate's clients
 * @url http://test.njs.remotestaff.com.au/staff/get-staff-clients/?id=74
 * @param int id 
 */
router.get("/get-staff-clients", function(req,res,next){
	var Staff = mongoose.model("Staff", staffSchema);
	mongoose.connect("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
	var db = mongoose.connection;
	var id = parseInt(req.query.id);
	db.once('open', function(){
		Staff.findOne({userid:id}).exec(function(err, staff){
			
			staff.getContracts(renderContracts);
			function renderContracts(err, contracts){				
				db.close();				
				
				console.log(contracts);
				var data = [];
				contracts.forEach(function (item) {
					//console.log(item);
					data.push({
						doc_id : item._id,
						subcontractors_id : item.subcontractors_id,
						userid : item.userid,
						staff_name : item.personal_detail.fname+" "+item.personal_detail.lname,
						personal_email : item.personal_detail.email,
						staff_email : item.subcontractors_detail.staff_email,
						client_id : item.leads_detail.id,
						client_name : item.leads_detail.fname+" "+item.leads_detail.lname,
						client_email : item.leads_detail.email,
						staffing_consultant_id : item.staffing_consultant_detail.admin_id,
						staffing_consultant : item.staffing_consultant_detail.fname+" "+item.staffing_consultant_detail.lname,
						recruiter_id : item.recruiters_detail.id,
						recruiter : item.recruiters_detail.fname+" "+item.recruiters_detail.lname,
						status : item.subcontractors_detail.status,
						client_price : item.subcontractors_detail.client_price,
						php_monthly : item.subcontractors_detail.php_monthly,
						client_timezone : item.subcontractors_detail.client_timezone,
						job_designation : item.subcontractors_detail.job_designation,
						service_type : item.subcontractors_detail.service_type,
						work_status : item.subcontractors_detail.work_status,
						staff_start_work_hour : item.subcontractors_detail.staff_start_work_hour,
						staff_finish_work_hour : item.subcontractors_detail.staff_finish_work_hour,
						client_start_work_hour : item.subcontractors_detail.client_start_work_hour,
						client_finish_work_hour : item.subcontractors_detail.client_finish_work_hour,
						staff_working_timezone : item.subcontractors_detail.staff_working_timezone,
						cancelled_contract_length_precision : item.subcontractors_detail.cancelled_contract_length_precision,
						date_contracted : item.subcontractors_detail.date_contracted,
						starting_date : formatDate(item.subcontractors_detail.starting_date),
					});
				});
				var result = {success:true, contracts : data};
				return res.send(result, 200);	
			}
			
		});
	});
});

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}


module.exports = router;