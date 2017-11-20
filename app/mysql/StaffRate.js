
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var staffRateSchema = sequelize.define('staff_rate',{

        product_id: {type: Sequelize.INTEGER},
        part_time_product_id: {type: Sequelize.INTEGER},
        date_updated: {type: Sequelize.DATE},
        admin_id: {type: Sequelize.INTEGER},
        full_time_negotiable: {type: Sequelize.STRING},
        part_time_negotiable: {type: Sequelize.STRING},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {

            saveData:function(data, userid){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                me.getStaffRateModel(userid).then(function(result){
                    var current_item = data;
                    current_item.date_updated = configs.getDateToday();
                    if(result){

                        staffRateSchema.update(current_item,{
                            where:{
                                userid: userid
                            }
                        }).then(function(updatedData){
                            willFulfillDeferred.resolve({success:true});
                        });

                    } else{


                        staffRateSchema.build(current_item).save().then(function(savedItem) {
                            willFulfillDeferred.resolve({success:true});
                        }).catch(function(error) {
                            willFulfillDeferred.resolve({success:true});
                            console.log(error);

                        });
                    }
                });



                return willFulfill;
            },


            getStaffRateModel:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                staffRateSchema.find({
                    where:
                    {
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
module.exports = staffRateSchema;