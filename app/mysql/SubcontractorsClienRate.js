var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var subcontractorsClientRateSchema = sequelize.define('subcontractors_client_rate',{

    id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    subcontractors_id: {type: Sequelize.INTEGER},
    start_date: {type: Sequelize.DATE},
    end_date: {type: Sequelize.DATE},
    rate: {type: Sequelize.FLOAT},
    client_price: {type: Sequelize.FLOAT},
    work_status: {type: Sequelize.STRING},
    date_added: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
});




//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = subcontractorsClientRateSchema;