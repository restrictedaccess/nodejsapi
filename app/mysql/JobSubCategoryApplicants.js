var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var jobCategorySchema = require("./Category");
var jobSubCategorySchema = require("./SubCategory");


var sequelize = require("../mysql/sequelize");


var jobSubCategoryApplicantsSchema = sequelize.define('job_sub_category_applicants',{

    userid: {type: Sequelize.INTEGER},
    ratings: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    category_id: {type: Sequelize.INTEGER},
    sub_category_id: {type: Sequelize.INTEGER},
    sub_category_applicants_date_created: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{

        getById: function(jsca_id){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;


            jobSubCategoryApplicantsSchema.find({
                where:{
                    id:jsca_id
                },
            }).then(function(foundObject){

                function fetchCategory(){
                    var fetchDefer = Q.defer();
                    var fetchPromise = fetchDefer.promise;

                    var current_item = foundObject;

                    var category_id = current_item.category_id;

                    Q.delay(100).then(function(){
                        jobCategorySchema.getCategory(category_id, true).then(function(foundCategory){
                            if(foundCategory){
                                foundObject["dataValues"]["category_info"] = foundCategory.dataValues;
                            }

                            fetchDefer.resolve(foundCategory);
                        });
                    });

                    return fetchPromise;
                }

                function fetchSubCategory(){
                    var fetchDefer = Q.defer();
                    var fetchPromise = fetchDefer.promise;

                    var current_item = foundObject;

                    var sub_category_id = current_item.sub_category_id;

                    Q.delay(100).then(function(){
                        jobSubCategorySchema.getSubCategory(sub_category_id, true).then(function(foundSubCategory){
                            if(foundSubCategory){
                                foundObject["dataValues"]["sub_category_info"] = foundSubCategory.dataValues;
                            }

                            fetchDefer.resolve(foundSubCategory);
                        });
                    });

                    return fetchPromise;
                }


                if(foundObject){
                    var all_category_fetch = [];


                    all_category_fetch.push(fetchCategory());
                    all_category_fetch.push(fetchSubCategory());


                    var allFetchPromises = Q.allSettled(all_category_fetch);
                    allFetchPromises.then(function(results){
                        willFulfillDeferred.resolve(foundObject);
                    });

                } else{
                    willFulfillDeferred.resolve(foundObject);
                }


            });

            return willFulfill;
        },

        getCategoriesByRatings:function(userid, ratings){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            jobSubCategoryApplicantsSchema.findAll({
                where:{
                    userid:userid,
                    ratings:ratings
                },
            }).then(function(foundObjects){
                willFulfillDeferred.resolve(foundObjects);
            });


            return willFulfill;
        },

        getCatgoriesData:function(userid, fetchCategories){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            jobSubCategoryApplicantsSchema.findAll({
                where:{
                    userid:userid
                },
            }).then(function(foundObjects){

                function fetchCategory(i){
                    var fetchDefer = Q.defer();
                    var fetchPromise = fetchDefer.promise;

                    var current_item = foundObjects[i];

                    var category_id = current_item.category_id;

                    Q.delay(100).then(function(){
                        jobCategorySchema.getCategory(category_id, true).then(function(foundCategory){
                            if(foundCategory){
                                foundObjects[i]["dataValues"]["category_info"] = foundCategory.dataValues;
                            }

                            fetchDefer.resolve(foundCategory);
                        });
                    });

                    return fetchPromise;
                }

                function fetchSubCategory(i){
                    var fetchDefer = Q.defer();
                    var fetchPromise = fetchDefer.promise;

                    var current_item = foundObjects[i];

                    var sub_category_id = current_item.sub_category_id;

                    Q.delay(100).then(function(){
                        jobSubCategorySchema.getSubCategory(sub_category_id, true).then(function(foundSubCategory){
                            if(foundSubCategory){
                                foundObjects[i]["dataValues"]["sub_category_info"] = foundSubCategory.dataValues;
                            }

                            fetchDefer.resolve(foundSubCategory);
                        });
                    });

                    return fetchPromise;
                }


                if(fetchCategories){
                    var all_category_fetch = [];


                    for(var i = 0;i < foundObjects.length;i++){
                        all_category_fetch.push(fetchCategory(i));
                        all_category_fetch.push(fetchSubCategory(i));
                    }

                    var allFetchPromises = Q.allSettled(all_category_fetch);
                    allFetchPromises.then(function(results){
                        willFulfillDeferred.resolve(foundObjects);
                    });

                } else{
                    willFulfillDeferred.resolve(foundObjects);
                }


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
module.exports = jobSubCategoryApplicantsSchema;
