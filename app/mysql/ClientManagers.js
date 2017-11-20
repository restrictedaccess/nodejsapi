var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var managersInfoSchema = sequelize.define('client_managers',{

		id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
		leads_id: {type: Sequelize.INTEGER},
		fname: {type: Sequelize.STRING},
		lname: {type: Sequelize.STRING},
		email: {type: Sequelize.STRING},
        manage_leave_request: {type: Sequelize.STRING},
        view_staff: {type: Sequelize.STRING},

	},
	{

		freezeTableName : true,
		timestamps: false,
		classMethods:
		{
			getBasicInfo:function(id){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				managersInfoSchema.find({
					attributes:
						['id','fname','lname','email'],
					where:
					{
						id:id
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
module.exports = managersInfoSchema;
