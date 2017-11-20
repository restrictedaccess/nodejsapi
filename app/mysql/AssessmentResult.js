
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var assessmentListSchema = require("../mysql/AssessmentList");

var sequelize = require("../mysql/sequelize");

var assessmentResultsSchema = sequelize.define('assessment_results',{

        result_uid: {type: Sequelize.INTEGER},
        result_aid: {type: Sequelize.INTEGER},
        result_date: {type: Sequelize.DATE},
        result_pct: {type: Sequelize.INTEGER},
        result_url: {type: Sequelize.STRING},
        result_selected: {type: Sequelize.BOOLEAN}
    },
    {

        freezeTableName : true,
        timestamps: false,
        classMethods:
        {
            batchSave: function(data){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var all_save_promises = [];

                function saveData(i){
                    var saveDefer = Q.defer();
                    var current_item = data[i];

                    Q.delay(100).then(function(){
                        assessmentResultsSchema.update(current_item,{
                            where:{
                                id: current_item.id
                            }
                        }).then(function(updatedData){
                            saveDefer.resolve({success:true});
                        });
                    });


                    return saveDefer.promise;
                }


                for(var i = 0;i < data.length;i++){
                    all_save_promises.push(saveData(i));
                }

                Q.allSettled(all_save_promises).then(function(results){
                    willFulfillDeferred.resolve(true);
                });


                return willFulfill;
            },

            getAssessmentResuls:function(userid, email){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                assessmentResultsSchema.findAll({
                    include: [{
                        model: assessmentListSchema,
                        required: false
                    }],
                    where:
                    {
                        $and : [
                            {
                                $or:[
                                    {
                                        result_uid:userid
                                    },
                                    {
                                        result_uid: email.trim()
                                    }
                                ]
                            },
                            {
                                "$assessment_list.status$": "active"
                            }
                        ]

                    },
                    order: "id DESC"
                }).then(function(foundObject){

                    willFulfillDeferred.resolve(foundObject);
                }).catch(function (err) {
                    console.log("Error Fetching skills tests");
                    console.log(err);
                    willFulfillDeferred.resolve(null);
                });

                return willFulfill;

            }
        }

    });

assessmentResultsSchema.belongsTo(assessmentListSchema, {foreignKey: {name: "result_aid", allowNull: true},targetKey: 'assessment_id'});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();

module.exports = assessmentResultsSchema;