var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var activateEntryNoteSchema = require("../mysql/ActivateEntryNote");
var preScreenedStaffSchema = require("../mysql/PreScreenStaff");

var sequelize = require("../mysql/sequelize");


var activateEntrySchema = sequelize.define('activate_candidate',{

    candidate_id: {type: Sequelize.INTEGER},
    date_time: {type: Sequelize.DATE},
    is_processed: {type: Sequelize.BOOLEAN},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        removeActivatedEntries:function(userid){
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            activateEntrySchema.update({is_processed: true},{
                where:{
                    candidate_id: userid
                }
            }).then(function(updatedData){
                console.log("Activated Entries Processed! ");
                willFulfillDeferred.resolve(true);
            });

            return willFulfill;
        },
        getEntries:function(where){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            activateEntrySchema.findAll({
                where:where,

            }).then(function(foundObjects){

                willFulfillDeferred.resolve(foundObjects);
            });

            return willFulfill;
        },
        saveData:function(data){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            data.date_time = configs.getDateToday();




            activateEntrySchema.build(data).save().then(function (savedItem) {

                var noteData = {
                    activate_candidate_id: savedItem.dataValues.id,
                    note: data.note
                };

                activateEntryNoteSchema.saveData(noteData);

                console.log("saved activate entry!");

                var pre_screen_data = {
                    userid: data.candidate_id,
                    admin_id: data.admin_id,
                    date: configs.getDateToday(),
                };

                preScreenedStaffSchema.saveSingle(pre_screen_data).then(function(savedData){
                    willFulfillDeferred.resolve({success:true});
                });


            }).catch(function (error) {

                console.log("error saving activate entry!");
                console.log(error);
                willFulfillDeferred.resolve({success:true});
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
module.exports = activateEntrySchema;
