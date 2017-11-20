var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');

var Lead_Info = require("../mysql/Lead_Info");

var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");

var Commission = sequelize.define("commission", {
	commission_id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	commission_title:{type: Sequelize.STRING},
	status:{type:Sequelize.STRING},
	payment_status : {type:Sequelize.STRING},
	paid_by_client : {type:Sequelize.STRING},
	date_paid_by_client : {type:Sequelize.DATE} 
}, {
	freezeTableName : true,
	timestamps: false,
	classMethods:
	{
		//Start methods
		updateCommission:function(id){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			Commission.update({
				status: 'finished',
				payment_status : 'paid by client',
				paid_by_client : 'y',
				date_paid_by_client : new Date()
			},{
				where:{
					commission_id: id
				}
			}).then(function(updatedData){
				willFulfillDeferred.resolve(id);
			});
			
			return willFulfill;
		}
		
		
		
		//End methods
	}
});

Commission.belongsTo(Lead_Info, {foreignKey:"leads_id"});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = Commission;