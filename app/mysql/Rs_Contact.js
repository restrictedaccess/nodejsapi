
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var leadsInfoSchema = require("../mysql/Lead_Info");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");


var rsContactSchema = sequelize.define('rs_contact_nos',{


    id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
    contact : {type: Sequelize.STRING},
    contact_no : {type: Sequelize.STRING},
    description : {type: Sequelize.STRING},
    type: {type: Sequelize.STRING},
    site: {type: Sequelize.STRING},
    active: {type: Sequelize.STRING}


},
{
  freezeTableName : true,
  timestamps: false,
  classMethods:
  {
    getrsContact:function()
    {
      var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

      rsContactSchema.findAll({

       attributes:[

         'contact_no','type','site'
       ],
       where:{
         active:"yes"
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
module.exports = rsContactSchema;
