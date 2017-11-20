
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var adminInfoSchema = sequelize.define('admin',{

	admin_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true // Automatically gets converted to SERIAL for postgres
		},
		admin_fname: {type: Sequelize.STRING},
		admin_lname: {type: Sequelize.STRING},
		admin_email: {type: Sequelize.STRING},
		signature_contact_nos: {type: Sequelize.STRING},
		signature_company: {type: Sequelize.STRING},
        currency_adjustment: {type: Sequelize.STRING},
			
	},
	{

		freezeTableName : true,
		timestamps: false,
		classMethods:
		{


			getAdminInfo:function(admin_id){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				adminInfoSchema.find({
					attributes:
						['admin_id','admin_fname','admin_lname','admin_email','signature_contact_nos','signature_company'],
					where:
					{
						admin_id:admin_id
					}
				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});

				return willFulfill;

			},
			isAdminAllowedCurrencyAdjustment:function(admin_id){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                adminInfoSchema.find({
                    attributes:
                        ['currency_adjustment'],
                    where:
                        {
                            admin_id:admin_id
                        }
                }).then(function(foundObject){
                	var is_allowed = true;
                	if(foundObject){
                		if(foundObject.currency_adjustment == "N"){
                            is_allowed = false;
						}
					}

                    willFulfillDeferred.resolve(is_allowed);
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
module.exports = adminInfoSchema;