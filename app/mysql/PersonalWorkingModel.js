
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var personalWorkingModelSchema = sequelize.define('personal_working_model',{

        working_model: {type: Sequelize.STRING},
        userid: {type: Sequelize.INTEGER},
        date_created: {type: Sequelize.DATE},
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

                var data_to_save = {
                    working_model: data,
                    userid: userid
                };


                me.getPersonalWorkingModel(userid).then(function(foundObject){

                    if(foundObject){
                        //update
                        personalWorkingModelSchema.update(data_to_save,{
                            where:{
                                id: foundObject.id
                            }
                        }).then(function(updatedData){
                            console.log("working model updated! " + foundObject.id);
                            willFulfillDeferred.resolve(true);
                        });
                    } else{
                        data_to_save.date_created = configs.getDateToday();
                        //insert
                        personalWorkingModelSchema.build(data_to_save).save().then(function(savedItem) {
                        }).catch(function(error) {
                            console.log("error saving Working Model!");
                            console.log(error);
                            willFulfillDeferred.resolve(true);

                        });
                    }
                });



                return willFulfill;
            },

            getPersonalWorkingModel:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                personalWorkingModelSchema.find({
                    where:
                    {
                        userid:userid
                    }
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
module.exports = personalWorkingModelSchema;