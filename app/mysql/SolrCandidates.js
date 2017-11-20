var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var personalInfoSchema = require("../mysql/Personal_Info");

var sequelize = require("../mysql/sequelize");


var solrCandidatesSchema = sequelize.define('solr_candidates',{

    userid: {type: Sequelize.INTEGER},
    date_synced: {type: Sequelize.DATE},


},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getCandidatesToSync:function(date_from, date_to){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            // userid NOT IN (SELECT userid FROM `solr_candidates`) AND

            personalInfoSchema.findAll({
                attributes: ["userid"],
                where:{
                    datecreated: {
                        $between: [date_from, date_to]
                    }
                }
            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
            });

            // sequelize.query("SELECT userid FROM `personal` WHERE datecreated BETWEEN :date_from AND :date_to",
            //     {
            //         replacements: {
            //             // date_from: new Date(Date.parse(moment(date_from).format("YYYY-MM-DD HH:mm:ss"))),
            //             // date_to: new Date(Date.parse(moment(date_to).format("YYYY-MM-DD HH:mm:ss")))
            //
            //
            //             date_from: new Date(moment_tz(date_from).format("YYYY-MM-DD HH:mm:ss")),
            //             date_to: new Date(moment_tz(date_to).format("YYYY-MM-DD HH:mm:ss"))
            //
            //         },
            //         type: sequelize.QueryTypes.SELECT
            //     }).then(function(candidates) {
            //     // We don't need spread here, since only the results will be returned for select queries
            //     willFulfillDeferred.resolve(candidates);
            // })

            return willFulfill;

        },
        getSolrCandidateData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            solrCandidatesSchema.find({
                where:{
                    userid:userid
                }
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },
        saveSolrCandidateData:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            var me = this;

            var new_data = {
                userid: userid,
                date_synced: configs.getDateToday()
            };
            
            me.getSolrCandidateData(userid).then(function(foundObject){
                if(foundObject){

                    solrCandidatesSchema.update(new_data,{
                        where:{
                            userid: userid
                        }
                    }).then(function(updatedData){
                        willFulfillDeferred.resolve({success:true});
                    });

                } else{
                    solrCandidatesSchema.build(new_data).save().then(function(savedItem) {
                        willFulfillDeferred.resolve({success:true, added: savedItem});
                    }).catch(function(error) {
                        console.log("error saving solr_candidates!");
                        console.log(error);
                        willFulfillDeferred.resolve({success:true});

                    });
                }
            });

            return willFulfill;

        },
        removeSolrCandidate:function(userid){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var me = this;

            me.getSolrCandidateData(userid).then(function(foundObject){
                if(foundObject){
                    foundObject.destroy().then(function(deletedRecord){
                        console.log("deleted solr_candidate " + userid);
                    });
                }
                willFulfillDeferred.resolve(true);
            });

            return willFulfill;

        },
    }
});




//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = solrCandidatesSchema;
