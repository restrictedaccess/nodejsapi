
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var sequelize = require("../mysql/sequelize");

var staffSkypesSchema = sequelize.define('staff_skypes',{

        skype_id: {type: Sequelize.STRING},
        userid: {type: Sequelize.INTEGER},
        subcontractors_id: {type: Sequelize.INTEGER},
        date_created: {type: Sequelize.DATE},
        date_updated: {type: Sequelize.DATE},
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {
            batchDelete: function(data){

                var me = this;
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;
                var deletePromises = [];

                function deleteItem(i){
                    var deleteDeferred = Q.defer();
                    var deletePromise = deleteDeferred.promise;

                    var current_item = data[i];

                    Q.delay(100).then(function(){
                        staffSkypesSchema.findOne({
                            attributes:['id'],
                            where:{
                                id: current_item.id,
                            }

                        }).then(function(foundObject){

                            if(foundObject){
                                foundObject.destroy().then(function(deletedRecord){
                                    console.log("deleted staff skype " + current_item.id);

                                    deleteDeferred.resolve({success:true});
                                });

                            } else{
                                deleteDeferred.resolve({success:false});
                            }

                        });
                    });

                    return deletePromise;
                }

                for(var i = 0;i < data.length;i++) {
                    deletePromises.push(deleteItem(i));
                }


                var allPromise = Q.allSettled(deletePromises);
                allPromise.then(function(results){
                    willFulfillDeferred.resolve(true);
                });

                willFulfillDeferred.resolve({succes:true});

                return willFulfill;

            },
            saveSingle: function(data){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                data.date_updated = configs.getDateToday();

                if(data.id){

                    staffSkypesSchema.update(data,{
                        where:{
                            id: data.id
                        }
                    }).then(function(updatedData){
                        willFulfillDeferred.resolve(updatedData);
                    });

                } else{

                    data.date_created = configs.getDateToday();

                    staffSkypesSchema.build(data).save().then(function(savedItem) {
                        willFulfillDeferred.resolve(savedItem);
                    }).catch(function(error) {
                        console.log(error);
                        willFulfillDeferred.reject(savedItem);

                    });
                }


                return willFulfill;
            },

            getStaffSkypes:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                staffSkypesSchema.findAll({
                    where:
                    {
                        userid:userid
                    }
                }).then(function(foundObjects){

                    willFulfillDeferred.resolve(foundObjects);
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
module.exports = staffSkypesSchema;