var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');

var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");

var CommissionHistory = sequelize.define("commission_history", {
	id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	commission_id:{type: Sequelize.INTEGER},
	date_changed : {type:Sequelize.DATE},
	changed_by_id :{type: Sequelize.INTEGER},
	changed_by_type :{type: Sequelize.STRING},
	changes :{type: Sequelize.INTEGER} 
}, {
	freezeTableName : true,
	timestamps: false,
	classMethods:
	{
		//Start methods
		insertHistory:function(id, order_id, admin_id){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			CommissionHistory.create({
		        commission_id : id,
		        date_changed : new Date(),
		        changed_by_id : admin_id,
		        changed_by_type : "admin",
				changes : "Processed Commission from "+order_id+".<br>Tagged Paid by Client.<br>Commission set to Finished"	
	      }).then(function(data){	
	          willFulfillDeferred.resolve(data);	
	      });
			
			return willFulfill;
		}
		
		
		
		//End methods
	}
});



//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = CommissionHistory;