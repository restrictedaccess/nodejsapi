var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");

var timesheetNotesAdmin = sequelize.define("timesheet_notes_admin", {
    id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
    timesheet_details_id : {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    timestamp: {type:Sequelize.DATE},
    note: {type:Sequelize.STRING}
}, {
    freezeTableName : true,
    timestamps: false,
    instanceMethods: {
    }
});
module.exports = timesheetNotesAdmin;