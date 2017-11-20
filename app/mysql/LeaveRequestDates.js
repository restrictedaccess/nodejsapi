var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var sequelize = require("../mysql/sequelize");

var LeaveRequestDates = sequelize.define('leave_request_dates',{
	id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	leave_request_id: {type: Sequelize.INTEGER},
	date_of_leave: {type: Sequelize.DATEONLY},
	status: {type: Sequelize.STRING}
},
	{

	 freezeTableName : true,
	 timestamps: false,
	 classMethods:
	 {
        //Start methods
        addLeaveRequestDates:function(leave_request_id, date_range, status){
        	        	
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;	
			
			var date_items=[];
			for(var i=0; i<date_range.length; i++){
				date_items.push({
					leave_request_id: leave_request_id,
					date_of_leave: date_range[i],
					status: status
				});
			}
			
			LeaveRequestDates.bulkCreate(
				date_items
			).then(function() {
				willFulfillDeferred.resolve(true);  
			});
			
			return willFulfill;
		},
		
		updateLeaveRequestDatesStatus:function(leave_request_id, selected_date_ids, status){
			
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;	
			
			LeaveRequestDates.update({
				status: status
			},{
				where:{
					leave_request_id : leave_request_id,
					$and : [
						{ id: [selected_date_ids] }
					]
					 
				}

			}).then(function(updatedData){
				willFulfillDeferred.resolve(true);
			});
			
			
			return willFulfill;
		}
	 	
	 	
	 	//End methods
	 }

});



//sequelize.sync();
module.exports = LeaveRequestDates;
