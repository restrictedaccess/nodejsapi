var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");


var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var mongoCredentials = configs.getMongoCredentials();

var timesheetDetailsModel = require("../models/TimeSheetDetails");
var Lead_Info = require("../mysql/Lead_Info");
var timesheetSchema = require("../mysql/Timesheet");
var timeSheetNotesSubcon = require("../mysql/TimeSheetNotesSubcon");
var quoteComponent = require("../components/Quote");
var ts_detailsComponent = require("../components/TimeSheetDetails");

var monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

var timesheetDetails = sequelize.define("timesheet_details", {
    id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
    timesheet_id : {type: Sequelize.INTEGER},
    day: {type: Sequelize.INTEGER},
    total_hrs: {type:Sequelize.FLOAT},
    adj_hrs: {type:Sequelize.FLOAT},
    regular_rostered: {type:Sequelize.FLOAT},
    hrs_charged_to_client: {type:Sequelize.FLOAT},
    diff_charged_to_client: {type:Sequelize.FLOAT},
    hrs_to_be_subcon: {type:Sequelize.FLOAT},
    diff_paid_vs_adj_hrs: {type:Sequelize.FLOAT},
    status:{type:Sequelize.STRING},
    reference_date:{type:Sequelize.DATE},
    notes_locked_date:{type:Sequelize.DATE},
    note_status:{type:Sequelize.STRING},
    note_done_date:{type:Sequelize.DATE},
}, {
    freezeTableName : true,
    timestamps: false,

    classMethods:{

        getDetails:function(ts_details_id){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            timesheetDetails.findOne({
                where:{
                    id:ts_details_id
                }
            }).then(function(foundObject){
                willFulfillDeferred.resolve(foundObject);
            });
            return willFulfill;
        },

        updateTimesheetDetailsStatus:function(id, status){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var params = {note_status: status.status};

            if(status.status == "done"){
              params["note_done_date"] = configs.getDateToday();
            }

            timesheetDetails.update(params,{
                where:{
                    id: id.id
                }
            }).then(function(updatedData){
                willFulfillDeferred.resolve({updatedData});
            });
            return willFulfill;
        },

        lockTimesheetNotes:function(start_date, end_date){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            timesheetDetails.update({notes_locked_date: configs.getDateToday()},{
                where:sequelize.literal('DATE(reference_date) BETWEEN "' + start_date + '" AND "' + end_date + '"'),
            }).then(function(updatedData){
                willFulfillDeferred.resolve(updatedData);
            });

            return willFulfill;
        },

    },

    instanceMethods: {

        getTS:function()
        {

            var ts_id = this.timesheet_id;
            var ts_schema = this.ts_schema;
            var me = this;

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            ts_schema.getTimesheet(ts_id).then(function(data){
                var sc = {};
                if(data.lead.hiring_coordinator_id || typeof data.lead.hiring_coordinator_id !== "undefined")
                {
                    quoteComponent.whosThis(data.lead.hiring_coordinator_id,"admin").then(function(admin){
                        sc.admin_id = parseInt(admin.admin_id);
                        sc.fname = admin.admin_fname;
                        sc.lname = admin.admin_lname;
                        sc.email = admin.admin_email;
                        me.time_sheet = data;
                        me.sc = sc;
                        willFulfillDeferred.resolve(me);

                    });
                }
                else
                {
                    willFulfillDeferred.resolve(me);
                }


            });

            return willFulfill;
        },
        getNotesSubcon:function()
        {
            var ts_details_id = this.id;
            var ts_notes_schema = this.ts_notes_schema
            var me = this;
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;


            ts_notes_schema.getNotes(ts_details_id).then(function(notes){
                me.notes = notes;
                willFulfillDeferred.resolve(me);
            });

            return willFulfill;
        },
        saveToMongo:function(params)
        {
            var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/timesheet",mongoCredentials.options);
            var timesheet_details = db.model('time_sheet_details',timesheetDetailsModel);

            var ts_details = this;
            var ts = this.time_sheet;
            var notes = this.notes;
            var note = [];
            var sc = this.sc;
            var send_notes = {};
            var email_content = {};
            var monthYear = monthNames[new Date(ts.month_year).getMonth()] + " "+new Date(ts.month_year).getFullYear();

            email_content.ts = ts;
            email_content.montYear = monthYear;
            email_content.ts_details = ts_details;
            email_content.sc = sc;
            email_content.id = params.ts_notes_id;
            for(var i = 0 ; i < notes.length ; i++)
            {
                item = notes[i];
                hasScreenshot = false;


                if(item.id == params.ts_notes_id)
                {
                    send_notes.notes = item.note;
                    send_notes.timestamp = item.timestamp.toDateString();
                    send_notes.category = item.notes_category;
                    send_notes.file_name = item.file_name;
                    send_notes.has_screenshot = item.has_screenshot;
                }

                note.push({
                    text:item.note,
                    id:parseInt(item.id),
                    has_screenshot:item.has_screenshot,
                    notes_category : item.notes_category,
                    file_name:item.file_name,
                    working_hrs:item.working_hrs,
                    timestamp:item.timestamp
                });
            }
            email_content.sendNotes = send_notes;
            var temp = {
                id: ts_details.id,
                timesheet_id: ts_details.timesheet_id,
                notes:note,
                adj_hrs: ts_details.adj_hrs,
                total_hrs: ts_details.total_hrs,
                user_info:{
                    userid:parseInt(ts.personal.userid),
                    fname:ts.personal.fname,
                    lname:ts.personal.lname,
                    email:ts.personal.email,
                },
                subcon_details:{
                    id:ts.subcontractor.id,
                    staff_email:ts.subcontractor.staff_email
                },
                leads_info:{
                    id:parseInt(ts.lead.id),
                    fname:ts.lead.fname,
                    lname:ts.lead.lname,
                    email:ts.lead.email,
                    status:ts.lead.status
                },
                assigned_sc:sc,
                status: ts_details.status,
                date_created:new Date(ts_details.reference_date),
                date_updated:new Date()
            }

            db.once("open",function(){

                try {
                    var filter = {id:parseInt(ts_details.id)}
                    timesheet_details.findOneAndUpdate(filter,temp,{upsert:true},function(err,doc){

                        if(err)
                        {
                            console.log(err);
                        }
                        ts_detailsComponent.prepareSend(email_content)//sending of email

                        db.close();
                    });

                }catch(e)
                {

                    console.log(e);
                    db.close();
                }

            });
        },


    }
});


timesheetDetails.hasMany(timeSheetNotesSubcon, {foreignKey:"timesheet_details_id"});
// timesheetDetails.belongsTo(timesheetSchema, {foreignKey: "timesheet_id"});



module.exports = timesheetDetails;
