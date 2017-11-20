/**
 * Created by joenefloresca on 02/02/2017.
 */
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');

var sequelize = require("../mysql/sequelize");

var educationSchema = sequelize.define('education',
    {
        id: {type:Sequelize.INTEGER, primaryKey:true, autoIncrement: true},
        userid: {type: Sequelize.INTEGER},
        educationallevel: {type: Sequelize.STRING},
        fieldstudy: {type: Sequelize.STRING},
        major: {type: Sequelize.STRING},
        grade: {type: Sequelize.STRING},
        gpascore: {type: Sequelize.INTEGER},
        college_name: {type: Sequelize.STRING},
        college_country: {type: Sequelize.STRING},
        graduate_month: {type: Sequelize.STRING},
        graduate_year: {type: Sequelize.STRING},
        trainings_seminars: {type: Sequelize.STRING},
        licence_certification: {type: Sequelize.STRING},
    },
    {
        freezeTableName: true,
        timestamps: false,
        classMethods:
            {
                getEducationInfo: function (userid, will_fetch_all) {

                    var willFulfillDeferred = Q.defer();
                    var willFulfill = willFulfillDeferred.promise;

                    var attributes = ['id', 'userid'];

                    if(will_fetch_all){
                        attributes.push("educationallevel");
                        attributes.push("fieldstudy");
                        attributes.push("major");
                        attributes.push("grade");
                        attributes.push("gpascore");
                        attributes.push("college_name");
                        attributes.push("college_country");
                        attributes.push("graduate_month");
                        attributes.push("graduate_year");
                        attributes.push("trainings_seminars");
                        attributes.push("licence_certification");
                    }

                    educationSchema.find({
                        attributes: attributes,
                        where: {
                            userid: userid
                        }
                    }).then(function (foundObject) {

                        willFulfillDeferred.resolve(foundObject);
                    });

                    return willFulfill;

                },
                saveInfo: function (education_info_data) {

                    var education_info = JSON.parse(JSON.stringify(education_info_data));

                    if(education_info.userid){
                        education_info.userid = education_info.userid
                    }

                    // if(education_info.education.id){
                    //     education_info.id = education_info.education.id
                    // }

                    if(education_info.college_country){
                        education_info.college_country = education_info.college_country
                    }

                    if(education_info.college_name){
                        education_info.college_name = education_info.college_name
                    }

                    if(education_info.educationallevel){
                        education_info.educationallevel = education_info.educationallevel
                    }

                    if(education_info.fieldstudy){
                        education_info.fieldstudy = education_info.fieldstudy
                    }

                    if(education_info.gpascore){
                        education_info.gpascore = education_info.gpascore
                    }

                    if(education_info.grade){
                        education_info.grade = education_info.grade
                    }

                    if(education_info.graduate_month){
                        education_info.graduate_month = education_info.graduate_month
                    }

                    if(education_info.graduate_year){
                        education_info.graduate_year = education_info.graduate_year
                    }

                    if(education_info.licence_certification){
                        education_info.licence_certification = education_info.licence_certification
                    }

                    if(education_info.major){
                        education_info.major = education_info.major
                    }

                    if(education_info.trainings_seminars){
                        education_info.trainings_seminars = education_info.trainings_seminars
                    }

                    function delay() {
                        return Q.delay(100);
                    }

                    var me = this;
                    var willFulfillDeferred = Q.defer();
                    var willFulfill = willFulfillDeferred.promise;

                    delete education_info.id;

                    var current_item = education_info;

                    this.getEducationInfo(current_item.userid).then(function (foundRecord) {
                        if (foundRecord) {
                            educationSchema.update(current_item, {
                                where: {
                                    userid: current_item.userid
                                }
                            }).then(function (updatedData) {
                                willFulfillDeferred.resolve({success:true});
                                console.log("education info updated! " + current_item.userid);
                            });

                        } else {
                            educationSchema.build(current_item).save().then(function (savedItem) {

                                willFulfillDeferred.resolve({success:true});
                                console.log("saved Education info!");
                            }).catch(function (error) {

                                willFulfillDeferred.resolve({success:true});
                                console.log("error saving Education info!");
                                console.log(error);
                            });
                        }
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

module.exports = educationSchema;