var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var adminInfoSchema = require("../mysql/Admin_Info");

var sequelize = require("../mysql/sequelize");

var staffNoShowSchema = sequelize.define('staff_no_show', {

        admin_id: {type: Sequelize.INTEGER},
        userid: {type: Sequelize.INTEGER},
        service_type: {type: Sequelize.STRING},
        date: {type: Sequelize.DATE},
        request_for_interview_id: {type: Sequelize.INTEGER},
    },
    {

        freezeTableName: true,
        timestamps: false,
        classMethods: {

            insertData: function(data){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                data.date = configs.getDateToday();

                staffNoShowSchema.build(data).save().then(function(savedItem) {
                    willFulfillDeferred.resolve(savedItem);
                }).catch(function(error) {
                    console.log(error);
                    willFulfillDeferred.reject(savedItem);

                });


                return willFulfill;
            },

            getNoShowHistory: function (userid) {
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                staffNoShowSchema.findAll({
                    include: [{model: adminInfoSchema, attributes: ["admin_fname", "admin_lname"]}],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObjects) {

                    willFulfillDeferred.resolve(foundObjects);
                });

                return willFulfill;

            },

        }

    });


staffNoShowSchema.belongsTo(adminInfoSchema, {foreignKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = staffNoShowSchema;