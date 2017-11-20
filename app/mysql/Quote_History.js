
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var leadsInfoSchema = require("../mysql/Lead_Info");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");


var quoteHistorySchema = sequelize.define('quote_history',{


  id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
  created_by: {type:Sequelize.INTEGER},
  description: {type:Sequelize.TEXT},
  action: {type:Sequelize.STRING},
  date_created: {type:Sequelize.DATE},
	quote_id:{type:Sequelize.INTEGER}

},
{
  freezeTableName : true,
  timestamps: false,
  classMethods:
  {

    addHistory:function(params)
    {
      var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
      quoteHistorySchema.create({

        created_by:params.created_by,
        description:params.desc,
        action:params.action,
        date_created:new Date(),
				quote_id:params.quote_id

      }).then(function(data){

          willFulfillDeferred.resolve(data);

      });
      return willFulfill;
    },
    getHistory:function(params)
    {
      var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

      quoteHistorySchema.findAll({

        attributes:["created_by","description","action","date_created"],
        order: [
                 ['id', 'DESC']
             ],
						where:{
							quote_id: params
						}

      }).then(function(foundObject){

        willFulfillDeferred.resolve(foundObject);
      });

        return willFulfill;;

    }

  }

});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = quoteHistorySchema;
