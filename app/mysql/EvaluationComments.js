var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var adminInfoSchema = require("../mysql/Admin_Info");



var sequelize = require("../mysql/sequelize");


var evaluationCommentsSchema = sequelize.define('evaluation_comments',{

    userid: {type: Sequelize.INTEGER},
    comment_by: {type: Sequelize.INTEGER},
    comments: {type: Sequelize.STRING},
    comment_date: {type: Sequelize.DATE},
    ordering: {type: Sequelize.INTEGER}

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        saveSingle:function(data){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;


            if(data.id){

                evaluationCommentsSchema.update(data,{
                    where:{
                        id: data.id
                    }
                }).then(function(updatedData){
                    willFulfillDeferred.resolve({dataValues:data});
                });

            } else{

                data.comment_date = configs.getDateToday();

                evaluationCommentsSchema.build(data).save().then(function(savedItem) {
                    willFulfillDeferred.resolve(savedItem);
                }).catch(function(error) {
                    console.log(error);
                    willFulfillDeferred.reject(savedItem);

                });
            }


            return willFulfill;
        },
        batchDelete: function(evaluation_comments){

            function delay(){ return Q.delay(100); }
            var me = this;
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            var deletePromises = [];

            function deleteEvalNote(i){
                var deleteDeferred = Q.defer();
                var deletePromise = deleteDeferred.promise;

                var current_item = evaluation_comments[i];

                evaluationCommentsSchema.findOne({
                    attributes:['id'],
                    where:{
                        id: current_item.id,
                    }

                }).then(function(foundObject){

                    if(foundObject){
                        foundObject.destroy().then(function(deletedRecord){
                            deleteDeferred.resolve({success:true});
                            console.log("deleted Evaluation Comment " + current_item.id);
                        });

                    } else{
                        deleteDeferred.resolve({success:false});
                    }

                });
                return deletePromise;
            }

            for(var i = 0;i < evaluation_comments.length;i++) {
                deletePromises.push(deleteEvalNote(i));
                deletePromises.push(delay);
            }


            var allPromise = Q.allSettled(deletePromises);
            allPromise.then(function(results){
                willFulfillDeferred.resolve(true);
            });

            willFulfillDeferred.resolve({succes:true});

            return willFulfill;

        },
        getEvaluationComments:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            evaluationCommentsSchema.findAll({
                include: [{model: adminInfoSchema, attributes:["admin_fname", "admin_lname"]}],
                where:
                {
                    userid:userid
                },
                order: "ordering ASC"
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        }
    }
});


evaluationCommentsSchema.belongsTo(adminInfoSchema, {foreignKey: "comment_by"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();

module.exports = evaluationCommentsSchema;
