var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var moment = require('moment');
var moment_tz = require('moment-timezone');

var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var sequelize = require("../mysql/sequelize");

var Utilities = require("../components/Utilities");

var LeaveRequestHistory = sequelize.define('leave_request_history',{
	id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	leave_request_id: {type: Sequelize.INTEGER},
	notes: {type: Sequelize.STRING},
	response_by_id: {type: Sequelize.INTEGER},
	response_by_type: {type: Sequelize.STRING},
	response_date: {type: Sequelize.DATEONLY}
	
},
	{

	 freezeTableName : true,
	 timestamps: false,
	 classMethods:
	 {
        //Start methods
        getHistory:function(leave_request_id){
        	var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var sql="SELECT id, response_date, DATE_FORMAT(response_date,'%Y-%m-%d %H:%i:%s')AS response_date_str, response_by_id, response_by_type, notes  from leave_request_history where leave_request_id="+leave_request_id+";";							
			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

				willFulfillDeferred.resolve(searchData);
			});

			return willFulfill;
        },
        
        
        
		insertLogs:function(leave_request_id, admin_id, selected_dates, status){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;	
			
			var today = moment_tz().tz("GMT");
			var atz = today.clone().tz("Asia/Manila");
			var phil_timestamp = atz.toDate();
			phil_timestamp = moment(phil_timestamp).format("YYYY-MM-DD HH:mm:ss");
				
			Utilities.whosThis(admin_id, "admin").then(function(the_who){
				
				status = status.charAt(0).toUpperCase() + status.slice(1);
						
				if(status == "Absent"){
					var notes = "MARKED ABSENT by "+the_who.fname+" "+the_who.lname;
				}else if(status == "Pending"){
					var notes = "Manually added in behalf of staff by "+the_who.fname+" "+the_who.lname;
				}else{
					var notes = status+" dates : <br>"+selected_dates.join("<br>");	
				}
				
				LeaveRequestHistory.create({				
					leave_request_id: leave_request_id,
					notes: notes,				
					response_by_id: admin_id,
					response_by_type: "admin",
					response_date: phil_timestamp
	
				}).then(function(data){
					willFulfillDeferred.resolve(true);
				});                
            });
			
			return willFulfill;
		}
	 	
	 	
	 	//End methods
	 }

});



//sequelize.sync();
module.exports = LeaveRequestHistory;
