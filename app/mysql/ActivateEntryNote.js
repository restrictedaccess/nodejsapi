var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();



var sequelize = require("../mysql/sequelize");


var activateEntryNoteSchema = sequelize.define('activate_candidate_note',{

    activate_candidate_id: {type: Sequelize.INTEGER},
    note: {type: Sequelize.STRING},
    date_time: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        saveData:function(data){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            data.date_time = configs.getDateToday();

            activateEntryNoteSchema.build(data).save().then(function (savedItem) {

                console.log("saved activate entry note!");
                willFulfillDeferred.resolve({success:true});
            }).catch(function (error) {

                console.log("error saving activate entry note!");
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
module.exports = activateEntryNoteSchema;
