/**
 * Created by joenefloresca on 04/03/2017.
 */
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var adminSchema = require("../mysql/Admin_Info");

var sequelize = require("../mysql/sequelize");
var voucherSchema = sequelize.define('voucher',{

    admin_id: {type: Sequelize.INTEGER},
    bp_id: {type: Sequelize.INTEGER},
    code_number: {type: Sequelize.STRING},
    comment: {type: Sequelize.STRING},
    limit_of_use: {type: Sequelize.INTEGER},
    date_expire: {type: Sequelize.DATE},
    date_created: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{


    }
});

voucherSchema.belongsTo(adminSchema, {foreignKey: "admin_id", targetKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = voucherSchema;
