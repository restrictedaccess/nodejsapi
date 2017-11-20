var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var voucherSchema = require("../mysql/Voucher");
var adminSchema = require("../mysql/Admin_Info");
var personalSchema = require("../mysql/Personal_Info");
var leadSchema = require("../mysql/Lead_Info");
var appAppointmentSchema = require("../mysql/AppAppointment");

var leadInfoSchema = require("../mysql/Lead_Info");
var interviewFeedbackSchema = require("../mysql/InterviewFeedback");


var sequelize = require("../mysql/sequelize");


var tbRequestForInterviewSchema = sequelize.define('tb_request_for_interview',{

    id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
    applicant_id: {type: Sequelize.STRING},
    leads_id: {type: Sequelize.INTEGER},
    comment: {type: Sequelize.STRING},
    date_interview: {type: Sequelize.DATE},
    time: {type: Sequelize.STRING},
    alt_time: {type: Sequelize.STRING},
    alt_date_interview: {type: Sequelize.DATE},
    time_zone: {type: Sequelize.STRING},
    status: {type: Sequelize.STRING},
    payment_status: {type: Sequelize.STRING},
    date_added: {type: Sequelize.DATE},
    booking_type: {type: Sequelize.STRING},
    service_type: {type: Sequelize.STRING},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getInterviewRecords:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbRequestForInterviewSchema.findAll({
                include: [{
                    model: leadInfoSchema,
                    attributes: ["fname", "lname"]
                }],
                where:{
                    applicant_id:userid
                },
            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
            });

            return willFulfill;

        },
        getInterviewData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbRequestForInterviewSchema.findAll({
                where:{
                    applicant_id:userid
                },
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },
        getInterviewHistory:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            tbRequestForInterviewSchema.findAll({
                include: [
                    {
                        model: voucherSchema,
                        attributes:["code_number"],
                        required: false,
                        include: [{
                            model: adminSchema,
                            required: false,
                            attributes:["admin_fname","admin_lname"],
                        }],
                    },
                    {
                        model: leadSchema,
                        required: true,
                        attributes:[["fname", "client_fname"], ["lname", "client_lname"]],
                    },
                    {
                        model: personalSchema,
                        required: false,
                        attributes:["fname", "lname"],
                    },

                    {
                        model: interviewFeedbackSchema,
                        attributes:["feedback", "admin_id", "date_created"],
                        include: [{
                            model: adminSchema,
                            required: false,
                            attributes:["admin_fname","admin_lname"],
                        }],
                    },
                    {
                        model:appAppointmentSchema,
                        attributes:["id"],
                        include: [{
                            model: adminSchema,
                            required: false,
                            attributes:["admin_fname","admin_lname"],
                        }],
                    }
                ],

                where:
                    {
                        applicant_id:userid
                    },
                // raw:true,
                order: "date_added DESC"
            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
            });

            return willFulfill;

        }

    }
});


tbRequestForInterviewSchema.belongsTo(voucherSchema, {foreignKey: "voucher_number", targetKey: "code_number"});
tbRequestForInterviewSchema.belongsTo(personalSchema, {foreignKey: "applicant_id", targetKey: "userid"});
tbRequestForInterviewSchema.belongsTo(leadSchema, {foreignKey: "leads_id", targetKey: "id"});
tbRequestForInterviewSchema.hasMany(interviewFeedbackSchema, {foreignKey: "request_for_interview_id", targetKey: "id"});

tbRequestForInterviewSchema.belongsTo(appAppointmentSchema, {foreignKey: "id", targetKey: "id"});


tbRequestForInterviewSchema.belongsTo(leadInfoSchema, {foreignKey: "leads_id"});



//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = tbRequestForInterviewSchema;
