var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var evaluationSchema = sequelize.define('evaluation',{

        userid: {type: Sequelize.INTEGER},
        evaluation_date: {type: Sequelize.DATE},
        work_fulltime: {type: Sequelize.STRING},
        work_parttime: {type: Sequelize.STRING}

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

                me.getData(userid).then(function(result){
                    var current_item = data;
                    if(result){

                        evaluationSchema.update(current_item,{
                            where:{
                                userid: userid
                            }
                        }).then(function(updatedData){
                            willFulfillDeferred.resolve({success:true});
                        });

                    } else{

                        current_item.evaluation_date = configs.getDateToday();

                        evaluationSchema.build(current_item).save().then(function(savedItem) {
                            willFulfillDeferred.resolve({success:true});
                        }).catch(function(error) {
                            willFulfillDeferred.resolve({success:true});
                            console.log(error);

                        });
                    }
                });



                return willFulfill;
            },
            getData:function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                evaluationSchema.find({
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

module.exports = evaluationSchema;