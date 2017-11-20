
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var assessmentListSchema = sequelize.define('assessment_lists',{

        assessment_id: {type: Sequelize.INTEGER},
        assessment_title: {type: Sequelize.STRING},
        assessment_type: {type: Sequelize.STRING},
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

module.exports = assessmentListSchema;