var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var SAschema =  sequelize.define('service_agreement',{	
	
	service_agreement_id : {type: Sequelize.INTEGER, primaryKey:true},
	quote_id: {type: Sequelize.INTEGER},
	leads_id: {type: Sequelize.INTEGER},
	created_by: {type: Sequelize.INTEGER},
	created_by_type: {type:Sequelize.STRING},
	date_created: {type: Sequelize.DATE},
	status: {type: Sequelize.STRING},
	date_posted: {type: Sequelize.DATE},
	posted_by: {type: Sequelize.INTEGER},
	posted_by_type: {type: Sequelize.STRING},
	ran: {type: Sequelize.STRING},
	accepted: {type: Sequelize.STRING},
	date_accepted: {type: Sequelize.DATE},
	date_opened: {type: Sequelize.DATE},
	date_removed: {type: Sequelize.DATE}	
},{
	freezeTableName : true,
	timestamps: false,
	classMethods:
	{
		getServiceAgreement:function(quote_id){
			
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
				SAschema.findAll({
		 			
		 			where:
		 			{
		 				quote_id: quote_id
		 			},
					order: [
						['service_agreement_id', 'DESC']
					]
			 		}).then(function(foundObject){
						
						willFulfillDeferred.resolve(foundObject);
					});
					
				return willFulfill;
		 		
		},
		getQuoteIDbyRAN:function (ranVal) {
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			SAschema.findOne({

				attributes:[
					"quote_id"
				],

				where:
				{
					ran: ranVal
				}
			}).then(function(foundObject){

				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;;


		},
		acceptServiceAgreement:function(sa_id)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			SAschema.update({

				accepted:"yes",
                status:"posted",
				date_accepted:new Date(),
				date_posted:new Date()

			},{
				where:{
					service_agreement_id:sa_id
				}
			}).then(function(updateData){


				willFulfillDeferred.resolve(updateData);
			});

			return willFulfill;
		},
		getRanBySA:function(sa_id)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			SAschema.findOne({

				attributes:[
					"ran"
				],

				where:
				{
					service_agreement_id:sa_id
				}
			}).then(function(foundObject){

				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;

		}
	}
});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = SAschema;
