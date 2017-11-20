var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var jobSubCategorySchema = sequelize.define('job_sub_category',{

    status: {type: Sequelize.STRING},
    category_id: {type: Sequelize.INTEGER},
    sub_category_name: {type: Sequelize.STRING},
    singular_name: {type: Sequelize.STRING},
    url: {type: Sequelize.STRING},
    description: {type: Sequelize.STRING},
    title: {type: Sequelize.STRING},
    meta_description: {type: Sequelize.STRING},
    keywords: {type: Sequelize.STRING},
    page_header: {type: Sequelize.STRING},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getSubCategory:function(sub_category_id, fetch_all_fields){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var attributes = ["status", "sub_category_name", "singular_name", "category_id", "sub_category_id"];
            var all_attributes = [
                "status",
                "category_id",
                "sub_category_name",
                "singular_name",
                "url",
                "description",
                "title",
                "meta_description",
                "keywords",
                "sub_category_id",
                "page_header"
            ];

            var query = {
                where:{
                    sub_category_id:sub_category_id
                },
            };

            if(!fetch_all_fields){
                query.attributes = attributes;
            } else{
                query.attributes = all_attributes;
            }

            jobSubCategorySchema.find(query).then(function(foundObject){


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
module.exports = jobSubCategorySchema;
