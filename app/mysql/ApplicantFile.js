var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment_tz = require('moment-timezone');



var GridFsComponent = require('../components/GridFs');
var gridFsInstance = new GridFsComponent();

var sequelize = require("../mysql/sequelize");

var applicantFilesSchema = sequelize.define('tb_applicant_files', {

        userid: {type: Sequelize.INTEGER},
        file_description: {type: Sequelize.STRING},
        name: {type: Sequelize.STRING},
        permission: {type: Sequelize.STRING},
        date_created: {type: Sequelize.DATE},
        is_lock: {type: Sequelize.BOOLEAN},
    },
    {

        freezeTableName: true,
        timestamps: false,
        classMethods: {

            getFilesByFileDescription: function(query, attributes){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var me = this;

                var options = {
                    where: query
                };

                if(attributes){
                    options.attributes = attributes;
                }

                applicantFilesSchema.findAll(options).then(function (foundObjects) {
                    willFulfillDeferred.resolve(foundObjects);
                });



                return willFulfill;
            },
            getActualFiles: function(userid){
                function delay(){ return Q.delay(100); }
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantFilesSchema.findAll({
                    attributes: ["name", "file_description"],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObjects) {
                    var applicant_files_meta_data = [];

                    var all_fetch_promises = [];

                    function getFromRemoteHost(i){
                        var fetchDeferred = Q.defer();
                        var fetchPromise = fetchDeferred.promise;

                        var current_file = foundObjects[i];
                        var applicant_file_path = configs.getPortalUrl() + "/applicants_files/" + current_file.dataValues.name;

                        var path = configs.getTmpFolderPath() + current_file.dataValues.name;

                        gridFsInstance.getFileFromRemoteHost(applicant_file_path, path).then(function(result){
                            if(result){
                                result.filename = current_file.dataValues.name;
                                result.file_type = current_file.dataValues.file_description;
                                applicant_files_meta_data.push(result);

                            }

                            fetchDeferred.resolve(result);

                        });


                        return fetchPromise;
                    }

                    if(foundObjects){
                        for(var i = 0;i < foundObjects.length;i++){
                            all_fetch_promises.push(getFromRemoteHost(i));
                            all_fetch_promises.push(delay);
                        }
                    }


                    var allPromise = Q.allSettled(all_fetch_promises);
                    allPromise.then(function(results){
                        willFulfillDeferred.resolve(applicant_files_meta_data);
                    });
                });

                return willFulfill;
            },

            fetchAll: function(userid){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantFilesSchema.findAll({
                    attributes: ['id', "file_description", "name", "permission", "date_created", "is_lock"],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObject) {
                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },
            saveFile: function (data) {
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                if(typeof data.id != "undefined"){
                    delete data.id;
                }

                if(typeof data.date_created != "undefined"){
                    delete data.date_created;
                }

                applicantFilesSchema.find({
                    attributes: ['id'],
                    where: {
                        name: data.name,
                        userid: data.userid
                    }
                }).then(function (foundObject) {

                    var today = moment_tz().tz("GMT");
                    var atz = today.clone().tz("Asia/Manila");
                    var timestamp = atz.toDate();

                    if (foundObject) {
                        applicantFilesSchema.update(data, {
                            where: {
                                id: foundObject.dataValues.id
                            }
                        }).then(function (updatedData) {
                            willFulfillDeferred.resolve({success: true, result: {id: foundObject.dataValues.id}});
                            console.log("sample work updated! " + foundObject.dataValues.id);
                        });

                    } else {
                        data.date_created = timestamp;

                        applicantFilesSchema.build(data).save().then(function (savedItem) {
                            willFulfillDeferred.resolve({success:true, result: savedItem});
                            console.log("saved Saved Sample work!");
                        }).catch(function (error) {
                            willFulfillDeferred.resolve({success:false, error: error});
                            console.log("error saving sample work!");
                            console.log(error);

                        });
                    }

                });

                return willFulfill;

            },

            removeFile: function (data) {

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                applicantFilesSchema.findOne({
                    attributes:['id'],
                    where:{
                        id: data.id,
                    }

                }).then(function(foundObject){

                    if(foundObject){
                        foundObject.destroy().then(function(deletedRecord){
                            willFulfillDeferred.resolve({success:true, result: deletedRecord});
                        });

                    } else{
                        willFulfillDeferred.resolve({success:false, error: "No such file!"});
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

module.exports = applicantFilesSchema;