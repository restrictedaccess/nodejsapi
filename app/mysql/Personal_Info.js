var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var moment = require('moment');
var moment_tz = require('moment-timezone');
var env = require("../config/env");


var GridFsComponent = require('../components/GridFs');
var gridFsInstance = new GridFsComponent();


var sequelize = require("../mysql/sequelize");
var personalInfoSchema = sequelize.define('personal',
    {

        userid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true // Automatically gets converted to SERIAL for postgres
        },
        fname: {type: Sequelize.STRING},
        lname: {type: Sequelize.STRING},
        email: {type: Sequelize.STRING},
        pass: {type: Sequelize.STRING},
        home_working_environment: {type: Sequelize.STRING},
        computer_hardware: {type: Sequelize.STRING},
        speed_test: {type: Sequelize.STRING},
        image: {type: Sequelize.STRING},
        voice_path: {type: Sequelize.STRING},
        gender: {type: Sequelize.STRING},
        nationality: {type: Sequelize.STRING},
        bday: {type: Sequelize.STRING},
        bmonth: {type: Sequelize.STRING},
        byear: {type: Sequelize.STRING},
        permanent_residence: {type: Sequelize.STRING},
        dateupdated: {type: Sequelize.DATE},
        datecreated: {type: Sequelize.DATE},
        skype_id: {type: Sequelize.STRING},
        tel_no: {type: Sequelize.STRING},
        handphone_no: {type: Sequelize.STRING},
        address1: {type: Sequelize.STRING},
        headset_quality: {type: Sequelize.STRING},
        internet_connection: {type: Sequelize.STRING},
        alt_email: {type: Sequelize.STRING},
        postcode : {type: Sequelize.STRING},
        state : {type: Sequelize.STRING},
        city : {type: Sequelize.STRING},
        pregnant : {type: Sequelize.STRING},
        pending_visa_application : {type: Sequelize.STRING},
        active_visa : {type: Sequelize.STRING},
        linked_in : {type: Sequelize.STRING},
        facebook_id : {type: Sequelize.STRING},
        marital_status : {type: Sequelize.STRING},
        handphone_country_code : {type: Sequelize.STRING},
        tel_area_code : {type: Sequelize.STRING},
        auth_no_type_id : {type: Sequelize.STRING},
        msia_new_ic_no : {type: Sequelize.STRING},
        icq_id: {type: Sequelize.STRING},
        referred_by: {type: Sequelize.STRING}
    },
    {

        freezeTableName: true,
        timestamps: false,
        classMethods: {
            getReferredBy: function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                personalInfoSchema.find({
                    attributes:
                        ['userid','referred_by'],
                    where:
                    {
                        userid:userid
                    }
                }).then(function(foundObject){

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },

            basicInfo: function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                personalInfoSchema.find({
                    attributes:
                        ['userid','fname','lname','email'],
                    where:
                    {
                        userid:userid
                    }
                }).then(function(foundObject){

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },

            evaluatComputerHardware: function(computer_hardwares_arr){

                var updated_computer_hardware = "";


                var found_desktop = false;
                var found_laptop = false;
                var found_headset = false;
                var found_headphone = false;
                var found_printer = false;
                var found_scanner = false;
                var found_tablet = false;
                var found_pen_tablet = false;


                var desktop_specs = "";
                var laptop_specs = "";
                var others_specs = "";

                for (var i = 0;i < computer_hardwares_arr.length;i++){
                    var current_item = computer_hardwares_arr[i];

                    if(current_item.type == "DESKTOP"){
                        if(!found_desktop){
                            found_desktop = true;
                            desktop_specs = "desktop,"+current_item["operating_system"]+","+current_item["processor"]+","+current_item["ram"]+"\n";
                        }
                    } else if(current_item.type == "LAPTOP"){
                        if(!found_laptop){
                            found_laptop = true;
                            laptop_specs = "laptop,"+current_item["operating_system"]+","+current_item["processor"]+","+current_item["ram"]+"\n";
                        }
                    } else if(current_item.type == "HEADSET"){
                        if(!found_headset){
                            found_headset = true;
                            others_specs += current_item["brand_name"]+"\n";
                        }
                    }
                    // else if(current_item.type == "HIGH_PERFORMANCE_HEADSET"){
                    //     if(!found_headphone){
                    //         found_headphone = true;
                    //         others_specs += current_item["brand_name"]+"\n";
                    //     }
                    // }

                    // else if(current_item.type == "PRINTER"){
                    //     if(!found_printer){
                    //         found_printer = true;
                    //         others_specs += current_item["brand_name"]+"\n";
                    //     }
                    // } else if(current_item.type == "SCANNER"){
                    //     if(!found_scanner){
                    //         found_scanner = true;
                    //         others_specs += current_item["brand_name"]+"\n";
                    //     }
                    // } else if(current_item.type == "TABLET"){
                    //     if(!found_tablet){
                    //         found_tablet = true;
                    //         others_specs += current_item["brand_name"]+"\n";
                    //     }
                    // } else if(current_item.type == "PEN_TABLET"){
                    //     if(!found_pen_tablet){
                    //         found_pen_tablet = true;
                    //         others_specs += current_item["brand_name"]+"\n";
                    //     }
                    // }

                }
                //FOR HIGH_PERFORMANCE_HEADSET
                others_specs += "\n";
                //FOR PRINTER
                others_specs += "\n";
                //FOR SCANNER
                others_specs += "\n";
                //FOR TABLET
                others_specs += "\n";
                //FOR PEN_TABLET
                others_specs += "\n";



                updated_computer_hardware = desktop_specs+laptop_specs+others_specs;


                return updated_computer_hardware;
            },

            getVoiceFile: function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                personalInfoSchema.find({
                    attributes: ["voice_path"],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObject) {
                    if(foundObject){
                        if(foundObject.dataValues.voice_path != "" && foundObject.dataValues.voice_path != null){
                            var voice_path = configs.getPortalUrl() + "/" + foundObject.dataValues.voice_path;

                            var ext_splitted = foundObject.dataValues.voice_path.split(".");

                            var path = configs.getTmpFolderPath() + userid + "." + ext_splitted[1];

                            gridFsInstance.getFileFromRemoteHost(voice_path, path).then(function(result){
                                willFulfillDeferred.resolve(result);
                            });

                        } else{
                            willFulfillDeferred.resolve(false);
                        }
                    } else{
                        willFulfillDeferred.resolve(false);
                    }
                    //willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },

            getImageFile: function(userid){
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;



                personalInfoSchema.find({
                    attributes: ["image"],
                    where: {
                        userid: userid
                    }
                }).then(function (foundObject) {
                    if(foundObject){
                        if(foundObject.dataValues.image != "" && foundObject.dataValues.image != null){
                            var image_path = configs.getPortalUrl() + "/" + foundObject.dataValues.image;

                            var ext_splitted = foundObject.dataValues.image.split(".");

                            var path = configs.getTmpFolderPath() + userid + "." + ext_splitted[1];

                            gridFsInstance.getFileFromRemoteHost(image_path, path).then(function(result){
                                willFulfillDeferred.resolve(result);
                            });

                        } else{
                            willFulfillDeferred.resolve(false);
                        }
                    } else{
                        willFulfillDeferred.resolve(false);
                    }
                    //willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;
            },
            getPersonalInfo: function (userid, will_fetch_all, attributes_to_fetch) {
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var attributes = ['fname', 'lname', 'email'];

                if(will_fetch_all){
                    attributes.push("userid");
                    attributes.push("home_working_environment");
                    attributes.push("computer_hardware");
                    attributes.push("speed_test");
                    attributes.push("image");
                    attributes.push("voice_path");
                    attributes.push("gender");
                    attributes.push("nationality");
                    attributes.push("bday");
                    attributes.push("byear");
                    attributes.push("bmonth");
                    attributes.push("permanent_residence");
                    attributes.push("dateupdated");
                    attributes.push("datecreated");
                    attributes.push("skype_id");
                    attributes.push("tel_no");
                    attributes.push("handphone_no");
                    attributes.push("address1");
                    attributes.push("headset_quality");
                    attributes.push("internet_connection");
                    attributes.push("postcode");
                    attributes.push("state");
                    attributes.push("city");
                    attributes.push("pregnant");
                    attributes.push("pending_visa_application");
                    attributes.push("active_visa");
                    attributes.push("linked_in");
                    attributes.push("facebook_id");
                    attributes.push("alt_email");
                    attributes.push("handphone_country_code");
                    attributes.push("tel_area_code");
                    attributes.push("marital_status");
                    attributes.push("auth_no_type_id");
                    attributes.push("msia_new_ic_no");
                    attributes.push("icq_id");
                }

                if(attributes_to_fetch){
                    attributes = attributes_to_fetch
                }



                personalInfoSchema.find({
                    attributes: attributes,
                    where: {
                        userid: userid
                    }
                }).then(function (foundObject) {

                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;

            },
            saveInfo: function (personal_data) {

                var personal_info = JSON.parse(JSON.stringify(personal_data));

                //construct data
                if(personal_info._id){
                    personal_info.userid = personal_info._id
                    try{
                        delete personal_info._id;
                        delete personal_info.id;
                    } catch(error){
                        console.log(error);
                    }

                }


                if(personal_info.first_name){
                    personal_info.fname = personal_info.first_name
                }


                if(personal_info.last_name){
                    personal_info.lname = personal_info.last_name
                }


                if(personal_info.birth_date){
                    personal_info.bday = moment(personal_info.birth_date).format("D");
                    personal_info.bmonth = moment(personal_info.birth_date).format("M");
                    personal_info.byear = moment(personal_info.birth_date).format("YYYY");
                }

                if(personal_info.permanent_residence_obj)
                {
                    personal_info.permanent_residence = personal_info.permanent_residence_obj.sortname;
                }



                function delay() {
                    return Q.delay(100);
                }

                var me = this;
                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                var allSaveInsertPromises = [];

                var saveInsertDeferred = Q.defer();
                var saveInsertPromise = saveInsertDeferred.promise;
                allSaveInsertPromises.push(saveInsertPromise);
                allSaveInsertPromises.push(delay);


                var current_item = personal_info;
                current_item.dateupdated = configs.getDateToday();


                if (current_item.userid) {
                    personalInfoSchema.update(current_item, {
                        where: {
                            userid: current_item.userid
                        }
                    }).then(function (updatedData) {
                        saveInsertDeferred.resolve({success: true});
                        console.log("personal info updated! " + current_item.userid);
                    }).catch(function (error) {
                        saveInsertDeferred.resolve({success: true});
                        console.log("error updating personal info!");
                        console.log(error);

                    });

                } else {
                    current_item.datecreated = configs.getDateToday();
                    personalInfoSchema.build(current_item).save().then(function (savedItem) {
                        saveInsertDeferred.resolve({success: true});
                        console.log("saved Personal info!");
                    }).catch(function (error) {
                        saveInsertDeferred.resolve({success: true});
                        console.log("error saving personal info!");
                        console.log(error);

                    });
                }

                var allPromise = Q.allSettled(allSaveInsertPromises);
                allPromise.then(function (results) {
                    willFulfillDeferred.resolve({success: true});
                });


                return willFulfill;
            },

            checkEmailIfExist:function(email){

                var willFulfillDeferred = Q.defer();
                var willFulfill = willFulfillDeferred.promise;

                personalInfoSchema.count({

                    where:{
                        email:email
                    }
                }).then(function(foundObject){

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

module.exports = personalInfoSchema;
