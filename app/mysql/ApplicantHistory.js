var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment_tz = require('moment-timezone');

var adminInfoSchema = require("../mysql/Admin_Info");
var agentInfoSchema = require("../mysql/Agent_Info");

var sequelize = require("../mysql/sequelize");



var applicantHistorySchema = sequelize.define('applicant_history',{

        id : {type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true},
        admin_id: {type: Sequelize.INTEGER},
        userid : {type: Sequelize.INTEGER},
        actions : {type: Sequelize.STRING},
        history : {type: Sequelize.STRING},
        date_created : {type: Sequelize.DATE},
        subject : {type: Sequelize.STRING},
        created_by_type: {type: Sequelize.STRING}

    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:{

            getAppHistory:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantHistorySchema.findAll({
                    where:
                    {
                        userid:userid
                    },
                    order:[
                        ["date_created","DESC"]
                    ]
                }).then(function(foundObject){

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;

            },
            addAppHisotry:function(data){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantHistorySchema.create({

                    admin_id: (data.admin_id ? data.admin_id : null),
                    userid : (data.userid ? data.userid : null),
                    actions : (data.actions ? data.actions : ""),
                    history : (data.history ? data.history : ""),
                    date_created : new Date(),
                    subject : (data.subject ? data.subject : ""),
                    created_by_type: (data.type ? data.type : "")

                }).then(function(data){

                    willFulfillDeferred.resolve(data);
                });

                return willFulfill;
            },
            updateAppHistory:function(data){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantHistorySchema.update({

                    history : (data.history ? data.history : "")

                },{

                    where:{
                        id:data.id
                    }

                }).then(function(updatedData){
                    willFulfillDeferred.resolve(updatedData);
                });

                return willFulfill;
            },
            deleteAppHistory:function(data){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantHistorySchema.destroy({
                    where: {
                        id:data.id
                    }

                }).then(function(rowDel){

                    if(rowDel == 1)
                    {
                        willFulfillDeferred.resolve(rowDel);
                    }
                    else
                    {
                        willFulfillDeferred.resolve(false);
                    }

                },function(err){

                    console.log(err);
                });

                return willFulfill;
            }
        },
        instanceMethods:
        {

            getAdminDetails:function(){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;
                var me = this;
                //
                // if(this.created_by_type == "admin")
                // {
                    adminInfoSchema.getAdminInfo(this.admin_id).then(function(data){


                        me.admin_details = data;
                        willFulfillDeferred.resolve(data);


                    }).catch(function(err){

                        console.log(err);
                        willFulfillDeferred.resolve(false);
                    });

                return willFulfill;

            },
            structureData:function(){

                var temp = {};
                var appHistory = this;
                var admin_details = this.admin_details;
                temp.id = appHistory.id;
                temp.admin_id = appHistory.admin_id;
                temp.actions = appHistory.actions;
                temp.history = appHistory.history;
                temp.date_created = appHistory.date_created;
                temp.subject = appHistory.subject;
                temp.created_by_type = appHistory.created_by_type;
                temp.admin_details = admin_details;



                return temp;


            }
        }

    });


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();

module.exports = applicantHistorySchema;