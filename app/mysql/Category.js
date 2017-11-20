var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var jobCategorySchema = sequelize.define('job_category',{

    status: {type: Sequelize.STRING},
    category_name: {type: Sequelize.STRING},
    singular_name: {type: Sequelize.STRING},
    created_by: {type: Sequelize.INTEGER},
    url: {type: Sequelize.STRING},
    description: {type: Sequelize.STRING},
    title: {type: Sequelize.STRING},
    meta_description: {type: Sequelize.STRING},
    keywords: {type: Sequelize.STRING},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getCategory:function(category_id, fetch_all_fields){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var attributes = ["status", "category_name", "singular_name", "category_id"];
            var all_attributes = [
                "status",
                "category_name",
                "singular_name",
                "created_by",
                "url",
                "description",
                "title",
                "meta_description",
                "keywords",
                "category_id"
            ]

            var query = {
                where:{
                    category_id:category_id
                },
            };

            if(!fetch_all_fields){
                query.attributes = attributes;
            } else{
                query.attributes = all_attributes;
            }

            jobCategorySchema.find(query).then(function(foundObject){


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

module.exports = jobCategorySchema;
