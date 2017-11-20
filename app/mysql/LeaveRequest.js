var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var moment = require('moment');
var moment_tz = require('moment-timezone');

var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var sequelize = require("../mysql/sequelize");

var LeaveRequest = sequelize.define('leave_request',{
	id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	userid: {type: Sequelize.INTEGER},
	leads_id: {type: Sequelize.INTEGER},
	leave_type: {type: Sequelize.STRING},
	reason_for_leave:{type: Sequelize.STRING},
	date_requested: {type: Sequelize.DATE},
    leave_duration: {type: Sequelize.STRING},
    timezone_id: {type: Sequelize.INTEGER}
},
	{

	 freezeTableName : true,
	 timestamps: false,
	 classMethods:
	 {
        //Start methods
		addLeaveRequest:function(params){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;	
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var phil_timestamp = atz.toDate();
			phil_timestamp = moment(phil_timestamp).format("YYYY-MM-DD HH:mm:ss");
			
			LeaveRequest.create({
				userid: params.staff.userid,
				leads_id: params.client.leads_id,
				leave_type : params.leave_type,
				reason_for_leave : params.reason_for_leave,
				date_requested : phil_timestamp,
			    leave_duration : params.leave_duration,
			    timezone_id : 1 //Defaulted Asia/Manila
			}).then(function(data){
				willFulfillDeferred.resolve(data.id);
			});
			
			
			return willFulfill;
		},
		
	 	search:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			/*
			var sql="SELECT DISTINCT(d.date_of_leave) FROM leave_request_dates d "+
				"JOIN leave_request l ON l.id = d.leave_request_id "+
				"WHERE DATE(d.date_of_leave) BETWEEN '"+params.start_date+"' AND '"+params.end_date+"' "+
				"ORDER BY d.date_of_leave DESC;";
			*/
			
			//console.log(params);
			//var conditions = "DATE(d.date_of_leave) BETWEEN '"+params.start_date+"' AND '"+params.end_date+"' ";
			var conditions = " d.status IS NOT NULL ";
			if(typeof params.userid != "undefined" && params.userid != ""){
				conditions += " AND l.userid="+params.userid+" ";
			}
			
			if(typeof params.csro_id != "undefined" && params.csro_id != ""){
				conditions += " AND c.csro_id="+params.csro_id+" ";
			}

			if(typeof params.client_id != "undefined" && params.client_id != ""){
				conditions += " AND l.leads_id="+params.client_id+" ";
			}

			if(typeof params.start_date != "undefined" && params.end_date != "" && typeof params.end_date != "undefined" && params.end_date != ""){
				conditions += " AND d.date_of_leave BETWEEN '"+params.start_date +"' AND '"+params.end_date +"' ";
			}

			if(typeof params.id != "undefined" && params.id != ""){
				conditions += " AND l.id =  "+params.id+" ";
			}
			
			
			var sql="SELECT (l.id)AS leave_request_id, l.userid, l.leads_id, l.leave_type, l.reason_for_leave, l.date_requested, (d.id)AS leave_request_dates_id, d.date_of_leave, DATE_FORMAT(l.date_requested,'%b %d %Y %h:%i %p')AS date_requested_str , DATE_FORMAT(d.date_of_leave,'%b %d, %Y %a')AS date_of_leave_str, UNIX_TIMESTAMP(l.date_requested)AS date_requested_unix, UNIX_TIMESTAMP(d.date_of_leave)AS date_of_leave_unix, d.status, CONCAT(p.fname,' ',p.lname)AS staff, CONCAT(c.fname,' ',c.lname)AS client, CONCAT(a.admin_fname,' ',a.admin_lname)AS admin  "+
				"FROM leave_request l "+
				"JOIN leave_request_dates d ON d.leave_request_id = l.id "+
				"JOIN personal p ON p.userid = l.userid "+
				"JOIN leads c ON l.leads_id = c.id "+
				"JOIN admin a ON a.admin_id = c.csro_id "+				
				"WHERE "+conditions+" "+
				"ORDER BY d.date_of_leave DESC;";
			
			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

				willFulfillDeferred.resolve(searchData);
			});

			return willFulfill;

		},

		searchLimit:function(params, page)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			var numrows = 500;	
			var skips = (page-1) * numrows;
			
			var conditions = " d.status IS NOT NULL ";
			if(typeof params.userid != "undefined" && params.userid != ""){
				conditions += " AND l.userid="+params.userid+" ";
			}
			
			if(typeof params.csro_id != "undefined" && params.csro_id != ""){
				conditions += " AND c.csro_id="+params.csro_id+" ";
			}

			if(typeof params.client_id != "undefined" && params.client_id != ""){
				conditions += " AND l.leads_id="+params.client_id+" ";
			}

			if(typeof params.start_date != "undefined" && params.end_date != "" && typeof params.end_date != "undefined" && params.end_date != ""){
				conditions += " AND d.date_of_leave BETWEEN '"+params.start_date +"' AND '"+params.end_date +"' ";
			}

			if(typeof params.id != "undefined" && params.id != ""){
				conditions += " AND l.id =  "+params.id+" ";
			}
			
			
			var sql="SELECT (l.id)AS leave_request_id, l.userid, l.leads_id, l.leave_type, l.reason_for_leave, l.date_requested, l.timezone_id, (d.id)AS leave_request_dates_id, d.date_of_leave, DATE_FORMAT(l.date_requested,'%b %d %Y %h:%i %p')AS date_requested_str , DATE_FORMAT(d.date_of_leave,'%b %d, %Y %a')AS date_of_leave_str, UNIX_TIMESTAMP(l.date_requested)AS date_requested_unix, UNIX_TIMESTAMP(d.date_of_leave)AS date_of_leave_unix, d.status, CONCAT(p.fname,' ',p.lname)AS staff, CONCAT(c.fname,' ',c.lname)AS client, CONCAT(a.admin_fname,' ',a.admin_lname)AS admin  "+
				"FROM leave_request l "+
				"JOIN leave_request_dates d ON d.leave_request_id = l.id "+
				"JOIN personal p ON p.userid = l.userid "+
				"JOIN leads c ON l.leads_id = c.id "+
				"JOIN admin a ON a.admin_id = c.csro_id "+				
				"WHERE "+conditions+" "+
				"ORDER BY d.date_of_leave DESC " +
				"LIMIT "+skips+" , "+numrows+";";
			
			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

				willFulfillDeferred.resolve(searchData);
			});

			return willFulfill;

		},

		searchByGroupLimit:function(params, page)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			var numrows = 500;	
			var skips = (page-1) * numrows;
			
			var conditions = " d.status IS NOT NULL ";
			if(typeof params.userid != "undefined" && params.userid != ""){
				conditions += " AND l.userid="+params.userid+" ";
			}
			
			if(typeof params.csro_id != "undefined" && params.csro_id != ""){
				conditions += " AND c.csro_id="+params.csro_id+" ";
			}

			if(typeof params.client_id != "undefined" && params.client_id != ""){
				conditions += " AND l.leads_id="+params.client_id+" ";
			}

			if(typeof params.start_date != "undefined" && params.end_date != "" && typeof params.end_date != "undefined" && params.end_date != ""){
				conditions += " AND d.date_of_leave BETWEEN '"+params.start_date +"' AND '"+params.end_date +"' ";
			}

			if(typeof params.id != "undefined" && params.id != ""){
				conditions += " AND l.id =  "+params.id+" ";
			}
			
			
			var sql="SELECT (l.id)AS leave_request_id, l.userid, l.leads_id, c.csro_id, l.leave_type, l.leave_duration, l.reason_for_leave, l.date_requested, DATE_FORMAT(l.date_requested,'%Y-%m-%d %H:%i:%s')AS date_requested_str , UNIX_TIMESTAMP(l.date_requested)AS date_requested_unix, CONCAT(p.fname,' ',p.lname)AS staff, CONCAT(c.fname,' ',c.lname)AS client, CONCAT(a.admin_fname,' ',a.admin_lname)AS staffing_consultant  "+
				"FROM leave_request l "+
				"JOIN leave_request_dates d ON d.leave_request_id = l.id "+
				"JOIN personal p ON p.userid = l.userid "+
				"JOIN leads c ON l.leads_id = c.id "+
				"JOIN admin a ON a.admin_id = c.csro_id "+				
				"WHERE "+conditions+" "+
				"GROUP BY l.id " +
				"LIMIT "+skips+" , "+numrows+" ; ";				
			
			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

				willFulfillDeferred.resolve(searchData);
			});

			return willFulfill;

		}

		

	 	
	 	//End methods
	 }

});



//sequelize.sync();
module.exports = LeaveRequest;