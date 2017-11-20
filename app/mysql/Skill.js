var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var skillsSchema = sequelize.define('skills',{

    userid: {type: Sequelize.INTEGER},
    skill: {type: Sequelize.STRING},
    experience: {type: Sequelize.FLOAT},
    proficiency: {type: Sequelize.STRING},
    date_time: {type: Sequelize.DATE}

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        batchDelete: function(skills){

            function delay(){ return Q.delay(100); }
            var me = this;
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var deletePromises = [];
            function deleteSkill(i){
                var deleteDeferred = Q.defer();
                var deletePromise = deleteDeferred.promise;

                var current_item = skills[i];

                skillsSchema.findOne({
                    attributes:['id'],
                    where:{
                        id: current_item.id,
                    }

                }).then(function(foundObject){

                    if(foundObject){
                        foundObject.destroy().then(function(deletedRecord){
                            deleteDeferred.resolve({success:true});
                            console.log("deleted skill " + current_item.id);
                        });
                    } else{
                        deleteDeferred.resolve({success:false});
                    }
                });

                return deletePromise;
            }


            for(var i = 0;i < skills.length;i++) {
                deletePromises.push(deleteSkill(i));
                deletePromises.push(delay);
            }


            var allPromise = Q.allSettled(deletePromises);
            allPromise.then(function(results){

                willFulfillDeferred.resolve({succes:true});
            });



            return willFulfill;

        },
        getSkills:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            skillsSchema.findAll({
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
module.exports = skillsSchema;
