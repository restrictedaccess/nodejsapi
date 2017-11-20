var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var inactiveStaffSchema = sequelize.define('inactive_staff',{

    userid: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    type: {type: Sequelize.STRING},
    date: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        saveSingle: function(data){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;


            if(data.id){

                inactiveStaffSchema.update(data,{
                    where:{
                        id: data.id
                    }
                }).then(function(updatedData){
                    willFulfillDeferred.resolve({dataValues:data});
                });

            } else{

                data.date = configs.getDateToday();

                inactiveStaffSchema.build(data).save().then(function(savedItem) {
                    willFulfillDeferred.resolve(savedItem);
                }).catch(function(error) {
                    console.log(error);
                    willFulfillDeferred.reject(savedItem);

                });
            }


            return willFulfill;
        },
        removeData: function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            inactiveStaffSchema.destroy({
                where: {
                    userid: userid
                }
            }).then(function(deletedRecords){
                console.log("deleted inactive entries");

                willFulfillDeferred.resolve({success:true});
            });
            // inactiveStaffSchema.find({
            //     where:{
            //         userid: userid,
            //     }
            // }).then(function(foundObjects){
            //
            //     if(foundObjects){
            //         foundObject.destroy().then(function(deletedRecord){
            //             console.log("deleted inactive entry");
            //
            //             willFulfillDeferred.resolve({success:true});
            //         });
            //
            //     } else{
            //         willFulfillDeferred.resolve({success:false});
            //     }
            //
            // });

            return willFulfill;
        },
        getInactiveData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            inactiveStaffSchema.findAll({
                where:{
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
module.exports = inactiveStaffSchema;
