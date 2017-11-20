var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var definedIndustriesSchema = require("../mysql/IndustryLookup");

var sequelize = require("../mysql/sequelize");


var previousJobIndustriesSchema = sequelize.define('previous_job_industries',{

    work_setup_type: {type: Sequelize.STRING},
    industry_id: {type: Sequelize.INTEGER},
    index: {type: Sequelize.INTEGER},
    userid: {type: Sequelize.INTEGER},
    date_created: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getPreviousJobIndustries:function(userid){

            function delay(){ return Q.delay(100); }
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;


            previousJobIndustriesSchema.findAll({
                where:
                {
                    userid:userid
                }
            }).then(function(foundObject){

                var object_to_resolve = [];

                var allFetchPromises = [];

                function fetchIndustries(i){
                    var current_job_industry = foundObject[i];
                    var fetchDeferred = Q.defer();
                    var fetchPromise = fetchDeferred.promise;

                    if(current_job_industry.industry_id){
                        definedIndustriesSchema.find({
                            attributes:
                                ['id','value'],
                            where:
                            {
                                id:current_job_industry.industry_id
                            }
                        }).then(function(foundObjectIndustry){
                            if(foundObjectIndustry){
                                current_job_industry.industry_id = foundObjectIndustry.id;
                                current_job_industry.industry_name = foundObjectIndustry.value;
                            }

                            fetchDeferred.resolve({success:true});
                        });
                    } else{

                        fetchDeferred.resolve({success:false});
                    }

                    return fetchPromise;
                }

                for(var i = 0;i < foundObject.length;i++){
                    allFetchPromises.push(fetchIndustries(i));
                    allFetchPromises.push(delay);
                }

                var allPromise = Q.allSettled(allFetchPromises);
                allPromise.then(function(results){

                    willFulfillDeferred.resolve(foundObject);
                });

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
module.exports = previousJobIndustriesSchema;
