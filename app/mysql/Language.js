var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");


var languagesSchema = sequelize.define('language',{

    userid: {type: Sequelize.INTEGER},
    language: {type: Sequelize.STRING},
    spoken: {type: Sequelize.INTEGER},
    written: {type: Sequelize.INTEGER},
    spoken_assessment: {type: Sequelize.INTEGER},
    written_assessment: {type: Sequelize.INTEGER}

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        batchDelete: function(languages){

            function delay(){ return Q.delay(100); }
            var me = this;
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            var deletePromises = [];

            function deleteLanguage(i){
                var deleteDeferred = Q.defer();
                var deletePromise = deleteDeferred.promise;

                var current_item = languages[i];

                languagesSchema.findOne({
                    attributes:['id'],
                    where:{
                        id: current_item.id,
                    }

                }).then(function(foundObject){

                    if(foundObject){
                        foundObject.destroy().then(function(deletedRecord){
                            deleteDeferred.resolve({success:true});
                        });

                    } else{
                        deleteDeferred.resolve({success:false});
                    }
                });

                return deletePromise;
            }

            for(var i = 0;i < languages.length;i++) {
                deletePromises.push(deleteLanguage(i));
                deletePromises.push(delay);
            }


            var allPromise = Q.allSettled(deletePromises);
            allPromise.then(function(results){
                willFulfillDeferred.resolve(true);
            });


            return willFulfill;

        },
        getLanguages:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            languagesSchema.findAll({
                where:
                {
                    userid:userid
                },
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
module.exports = languagesSchema;
