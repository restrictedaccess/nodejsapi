var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var moment = require('moment');
var moment_tz = require('moment-timezone');

var adminInfoSchema = require("../mysql/Admin_Info"); //getAdmin Details

var sequelize = require("../mysql/sequelize");


var staffHistorySchema = sequelize.define('staff_history',{

    userid: {type: Sequelize.INTEGER},
    change_by_id: {type: Sequelize.INTEGER},
    change_by_type: {type: Sequelize.STRING},
    changes: {type: Sequelize.STRING},
    date_change: {type: Sequelize.DATE}

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        batchSave: function(staff_hsitory) {
            function delay(){ return Q.delay(100); }
            var me = this;
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var allSaveInsertPromises = [];

            function saveData(i){
                var saveInsertDeferred = Q.defer();
                var saveInsertPromise = saveInsertDeferred.promise;

                var current_history = staff_hsitory[i];
                current_history.date_change = configs.getDateToday();


                staffHistorySchema.build(current_history).save().then(function(savedHistory) {
                    saveInsertDeferred.resolve({success:true});
                    console.log("saved history!");
                }).catch(function(error) {
                    saveInsertDeferred.resolve({success:true});
                    console.log("error saving staff_history!");
                    console.log(error);

                });

                return saveInsertPromise;
            }

            for(var i = 0;i < staff_hsitory.length;i++){
                allSaveInsertPromises.push(saveData(i));
                allSaveInsertPromises.push(delay);

            }


            var allPromise = Q.allSettled(allSaveInsertPromises);
            allPromise.then(function(results){

                willFulfillDeferred.resolve({success:true});
            });



            return willFulfill;
        },
        getStaffHistory:function(params)
        {
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            staffHistorySchema.findAll({

                offset:((params.page-1)*params.limit),
                limit : params.limit,
                include: [
                    {
                        model: adminInfoSchema,
                        attributes:["admin_fname","admin_lname"],
                        required: false,
                    },
                ],
                where:
                {
                    userid:params.userid
                },
                order:[
                    ["date_change","DESC"]
                ]
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },
        countData:function(userid)
        {
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            staffHistorySchema.count({

                where:{
                    userid:userid
                }

            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
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

            adminInfoSchema.getAdminInfo(this.change_by_id).then(function(data){


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
            var staffHistory = this;
            var admin_details = this.admin;
            temp.id = staffHistory.id;
            temp.change_by_id = staffHistory.change_by_id;
            temp.change_by_type = staffHistory.change_by_type;
            temp.changes = staffHistory.changes;
            temp.date_change = staffHistory.date_change;
            temp.admin_details = admin_details;

            return temp;


        }

    }
});


staffHistorySchema.belongsTo(adminInfoSchema, {foreignKey: "change_by_id", targetKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = staffHistorySchema;
