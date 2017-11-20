var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var adminInfoSchema = require("../mysql/Admin_Info");


var sequelize = require("../mysql/sequelize");


var recruiterStaffSchema = sequelize.define('recruiter_staff',{

    userid: {type: Sequelize.INTEGER},
    admin_id: {type: Sequelize.INTEGER},
    date: {type: Sequelize.DATE},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getRecruiter:function(userid, admin_id){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            var where = {
                userid:userid
            };

            if(typeof admin_id != "undefined"){
                where.admin_id = admin_id;
            }

            recruiterStaffSchema.find({
                where:where,
                order: "date DESC"
            }).then(function(foundObject){

                if(foundObject){

                    if(foundObject.admin_id){
                        //fetch admin info

                        adminInfoSchema.getAdminInfo(foundObject.admin_id).then(function(adminFound){
                            if(adminFound){
                                foundObject.admin_fname = adminFound.admin_fname;
                                foundObject.admin_lname = adminFound.admin_lname;
                                foundObject.admin_email = adminFound.admin_email;
                                foundObject.signature_contact_nos = adminFound.signature_contact_nos;
                                foundObject.signature_company = adminFound.signature_company;
                            }

                            willFulfillDeferred.resolve(foundObject);
                        });
                    } else{
                        willFulfillDeferred.resolve(foundObject);
                    }

                } else{
                    willFulfillDeferred.resolve(foundObject);
                }


            });

            return willFulfill;

        },
        assignRecruiterToCandidate:function(userid, admin_id) {

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            //update

            recruiterStaffSchema.getRecruiter(userid).then(function(candidateExistingRecruiterStaff){
                var new_data = {
                    userid: userid,
                    admin_id: admin_id,
                    date: configs.getDateToday()
                };
                if(candidateExistingRecruiterStaff){

                    recruiterStaffSchema.update(new_data,{
                        where:{
                            userid: userid
                        }
                    }).then(function(updatedData){
                        willFulfillDeferred.resolve({success:true});
                    });

                } else{

                    recruiterStaffSchema.build(new_data).save().then(function(savedItem) {
                        willFulfillDeferred.resolve({success:true});
                    }).catch(function(error) {
                        console.log(error);
                        willFulfillDeferred.resolve({success:true});

                    });
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
module.exports = recruiterStaffSchema;
