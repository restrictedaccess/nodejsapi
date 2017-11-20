var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var adminInfoSchema = require("../mysql/Admin_Info");

var complianceScShchema = sequelize.define('compliance_sc',{

	id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true // Automatically gets converted to SERIAL for postgres
		},
		admin_id: {type: Sequelize.INTEGER},
		compliance_id: {type: Sequelize.INTEGER},

	},
	{
		freezeTableName : true,
		timestamps: false,
		classMethods:
		{
			getAdminInfo:function(admin_id){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				complianceScShchema.findAll({
          include: [
              {
                  model: adminInfoSchema,
                  required: true,
                  attributes:["admin_id","admin_fname","admin_lname"],
              },
            ],
            where: {compliance_id: admin_id}
				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});

				return willFulfill;

			}
		}

	});

complianceScShchema.belongsTo(adminInfoSchema, {foreignKey:"admin_id"});
module.exports = complianceScShchema;
