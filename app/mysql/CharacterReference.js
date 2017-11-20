
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");

var characterReferencesSchema = sequelize.define('character_references',{

        userid: {type: Sequelize.INTEGER},
        position: {type: Sequelize.STRING},
        company: {type: Sequelize.STRING},
        contact_details: {type: Sequelize.STRING},
        name: {type: Sequelize.STRING},
        contact_number: {type: Sequelize.STRING},
        email_address: {type: Sequelize.STRING},
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
                        characterReferencesSchema.findOne({
                            attributes:['id'],
                            where:{
                                id: current_item.id,
                            }

                        }).then(function(foundObject){

                            if(foundObject){
                                foundObject.destroy().then(function(deletedRecord){
                                    console.log("deleted character reference " + current_item.id);

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

                    characterReferencesSchema.update(data,{
                        where:{
                            id: data.id
                        }
                    }).then(function(updatedData){
                        willFulfillDeferred.resolve({dataValues:data});
                    });

                } else{

                    data.date_created = configs.getDateToday();

                    characterReferencesSchema.build(data).save().then(function(savedItem) {
                        willFulfillDeferred.resolve(savedItem);
                    }).catch(function(error) {
                        console.log(error);
                        willFulfillDeferred.reject(savedItem);

                    });
                }


                return willFulfill;
            },
            getCharacterReferences:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                characterReferencesSchema.findAll({
                    where:
                    {
                        userid:userid
                    },
                    order: "id DESC"
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

module.exports = characterReferencesSchema;