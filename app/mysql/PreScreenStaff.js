var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var preScreenedStaffSchema = sequelize.define('pre_screened_staff',{

    userid: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    date: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        saveSingle:function(data){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;


            if(data.id){

                preScreenedStaffSchema.update(data,{
                    where:{
                        id: data.id
                    }
                }).then(function(updatedData){
                    willFulfillDeferred.resolve({dataValues:data});
                });

            } else{

                data.date = configs.getDateToday();

                preScreenedStaffSchema.build(data).save().then(function(savedItem) {
                    willFulfillDeferred.resolve(savedItem);
                }).catch(function(error) {
                    console.log(error);
                    willFulfillDeferred.resolve(false);

                });
            }


            return willFulfill;
        },
        getPrescreenData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            preScreenedStaffSchema.find({
                where:{
                    userid:userid
                },
                order: "id DESC"
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        }
    }
});




//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = preScreenedStaffSchema;
