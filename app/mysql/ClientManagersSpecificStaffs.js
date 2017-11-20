var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var managersInfoSchema = sequelize.define('client_managers_specific_staffs',{

        client_manager_id: {type: Sequelize.INTEGER},
        subcontractor_id: {type: Sequelize.INTEGER},

    },
    {

        freezeTableName : true,
        timestamps: false,

    });


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = managersInfoSchema;
