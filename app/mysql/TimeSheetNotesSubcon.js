var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");

var timesheetNotesSubcon = sequelize.define("timesheet_notes_subcon", {
    id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
    timesheet_details_id : {type: Sequelize.INTEGER},
    userid: {type: Sequelize.INTEGER},
    timestamp: {type:Sequelize.DATE},
    note: {type:Sequelize.STRING},

    has_screenshot: {type:Sequelize.BOOLEAN},
    file_name:{type:Sequelize.STRING},
    working_hrs:{type:Sequelize.FLOAT},
    notes_category:{type:Sequelize.STRING},

    has_screenshot: {type:Sequelize.STRING},
    notes_category: {type:Sequelize.STRING},

}, {
    freezeTableName : true,
    timestamps: false,
    classMethods:{

        addNotes:function(data){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            timesheetNotesSubcon.create(data,{isNewRecord:true}).then(function(insertedData){
                willFulfillDeferred.resolve(insertedData);
            });
            return willFulfill;
        },
        getNotes:function(ts_details_id)
        {
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            timesheetNotesSubcon.findAll({
                attributes:["id","note","has_screenshot","timestamp","file_name","working_hrs","notes_category"],
                where:{
                    timesheet_details_id : ts_details_id
                }

            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);

            });


            return willFulfill;

        }
    },
    instanceMethods: {
    }
});
module.exports = timesheetNotesSubcon;