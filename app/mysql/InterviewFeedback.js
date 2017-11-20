var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var adminSchema = require("../mysql/Admin_Info");

var sequelize = require("../mysql/sequelize");


var interviewFeedbackSchema = sequelize.define('request_for_interview_feedbacks',{

    feedback: {type: Sequelize.STRING},
    request_for_interview_id: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    date_created: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{

    }
});

interviewFeedbackSchema.belongsTo(adminSchema, {foreignKey: "admin_id", targetKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = interviewFeedbackSchema;