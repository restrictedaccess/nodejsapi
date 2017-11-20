var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var agentInfoSchema = sequelize.define('agent',{

		agent_no: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
		fname: {type: Sequelize.STRING},
		lname: {type: Sequelize.STRING},
		email: {type: Sequelize.STRING}


	},
	{

		freezeTableName : true,
		timestamps: false,
		classMethods:
		{
			getAgentInfo:function(agent_no){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				agentInfoSchema.find({
					attributes:
						['agent_no','fname','lname','email'],
					where:
					{
						agent_no:agent_no
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
module.exports = agentInfoSchema;