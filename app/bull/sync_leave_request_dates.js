var configs = require("../config/configs");
var env = require("../config/env");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var swig = require('swig');

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Queue = require('bull');

var moment = require('moment');
var moment_tz = require('moment-timezone');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();


var LeaveRequestDates = require("../mysql/LeaveRequestDates");
var AdminInfo = require("../mysql/Admin_Info");
var Lead_Info = require("../mysql/Lead_Info");
var Subcontractors = require("../mysql/Subcontractors");

var leaveRequestSchema = require("../models/LeaveRequest");

var ClientComponent = require("../components/Client");


var syncLeaveRequestDatesQueue = Queue("sync_leave_request_dates", 6379, '127.0.0.1');


syncLeaveRequestDatesQueue.process(function(job, done){

    var leave_request_id = job.data.leave_request_id;
    //console.log("Starting bull sync_leave_request_dates "+leave_request_id+" process...");
    //console.log(leave_request_id);
    //done(null, {success:true});


    function getLeaveRequestDates(leave_request_id){
        var deferred_promise = Q.defer();
        var promise = deferred_promise.promise;

        LeaveRequestDates.findAll({
            attributes : ['id', 'date_of_leave', 'status'],
            where: { leave_request_id: leave_request_id }

        }).then(function(records) {
            var dates=[];
            records.forEach(function(record){
                dates.push({
                    id : record.id,
                    date_of_leave : moment(record.date_of_leave).toISOString(),
                    status : record.status,
                    date_of_leave_str : moment(record.date_of_leave).format("ddd, MMM DD YYYY"),
                    date_of_leave_unix : moment(record.date_of_leave).unix()
                });
            });
            deferred_promise.resolve(dates);
        });
        return promise;
    }


    var allDates = null;
    var deferredPromise = Q.defer();
    var promise = deferredPromise.promise;

    function recursiveLeaveRequestDateGet(leave_request_id){

        getLeaveRequestDates(leave_request_id).then(function(dates){
            deferredPromise.resolve(true);
            allDates=dates;
        });
    }


    promise.then(()=>{

        var MongoClient = require('mongodb').MongoClient;
        MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
            if(err){
                throw(err);
            }else{
                //console.log("Connected to MongoDB");
                var leave_request_collection = db.collection("leave_request");
                var filter = {leave_request_id : leave_request_id};
				//console.log(allDates);
                leave_request_collection.update(filter, { $set: {date_items:allDates}} , {upsert:true}, function(err, result) {
                    if(err){
                        throw(err);
                        console.log(err);
                        db.close();
                    }else{
                        db.close();

                        var db_prod = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
                        var LeaveRequestModel = db_prod.model("LeaveRequest", leaveRequestSchema);
                        var LeaveRequestObj = new LeaveRequestModel();

                        db_prod.once("open", function(){
                            db_prod.close();
                            console.log("Fetching leave request " + leave_request_id);

                            LeaveRequestObj.getById(leave_request_id, true).then(function(foundRequest){
                                if(foundRequest){
                                    console.log("Sending Email");


                                    var current_doc = foundRequest;
                                    var staff_name = current_doc.staff;
                                    var client_name = current_doc.client;

                                    var bcc_array = null;
                                    var cc_array = [];

                                    var to_array = [];

                                    var leads_email = "";
                                    var staff_email = "";
                                    var job_designation = "";


                                    cc_array.push("attendance@remotestaff.com.au");

                                    var ClientComponentObj = new ClientComponent();

                                    var all_email_fetching_promises = [];

                                    var cc_array_managers_email = [];
                                    var cc_array_csro_email = [];


                                    var client_emails_fetching_promise = ClientComponentObj.get_client_managers_emails(current_doc.leads_id, current_doc.userid);

                                    var admin_email_fetching_promise = AdminInfo.findOne({
                                        where: {
                                            admin_id: current_doc.csro_id
                                        }
                                    });

                                    var leads_email_fetching_promise = Lead_Info.findOne({
                                        where:{
                                            id: current_doc.leads_id
                                        }
                                    });

                                    var staff_email_fetching_promise = Subcontractors.findOne({
                                        where:{
                                            leads_id: current_doc.leads_id,
                                            userid: current_doc.userid
                                        }
                                    });

                                    all_email_fetching_promises.push(client_emails_fetching_promise);

                                    all_email_fetching_promises.push(admin_email_fetching_promise);

                                    all_email_fetching_promises.push(leads_email_fetching_promise);

                                    all_email_fetching_promises.push(staff_email_fetching_promise);

                                    client_emails_fetching_promise.then(function(foundManagersEmail){

                                        if(foundManagersEmail.length > 0){
                                            for(var i = 0;i < foundManagersEmail.length;i++){
                                                cc_array_managers_email.push(foundManagersEmail[i]);
                                            }
                                        }


                                    });

                                    admin_email_fetching_promise.then(function(foundAdmin){
                                        if(foundAdmin){
                                            cc_array_csro_email.push(foundAdmin.admin_email);
                                        }
                                    });

                                    leads_email_fetching_promise.then(function(foundLeadsInfo){
                                        if(foundLeadsInfo){
                                            leads_email = foundLeadsInfo.email;
                                        }
                                    });

                                    staff_email_fetching_promise.then(function(foundStaffEmail){
                                        if(foundStaffEmail){
                                            staff_email = foundStaffEmail.staff_email;
                                            job_designation = foundStaffEmail.job_designation;
                                        }
                                    });



                                    Q.allSettled(all_email_fetching_promises).then(function(results){

                                        try{


                                            for(var i = 0;i < cc_array_managers_email.length;i++){
                                                cc_array.push(cc_array_managers_email[i]);
                                            }

                                            for(var i = 0;i < cc_array_csro_email.length;i++){
                                                cc_array.push(cc_array_csro_email[i]);
                                            }

                                            if(leads_email != ""){
                                                to_array.push(leads_email);
                                            }

                                            if(staff_email != ""){
                                                to_array.push(staff_email);
                                            }

                                            //Send Mail
                                            var subject = "Remotestaff Leave Request Staff " + staff_name + " to " + client_name + ".";

                                            current_doc.date_requested_str = moment(current_doc.date_requested).format("YYYY-MM-DD HH:mm:ss");
                                            var template = swig.compileFile(configs.getEmailTemplatesPath() + '/leave_request/add_leave_request.html');
                                            var output = template({
                                                subject: subject,
                                                data: current_doc,
                                                job_designation: job_designation
                                            });




                                            var MailboxComponent = require("../components/Mailbox");
                                            var mailbox_component = new MailboxComponent();

                                            var mailbox_doc = {
                                                bcc: bcc_array,
                                                cc: cc_array,
                                                from: "Leave Request Management<attendance@remotestaff.com.au>",
                                                sender: null,
                                                reply_to: null,
                                                generated_by: "NODEJS/leave-request/add-leave-request",
                                                html: output,
                                                text: null,
                                                to: to_array,
                                                sent: false,
                                                subject: subject
                                            };

                                            console.log("sending mail " + subject);
                                            mailbox_component.send(mailbox_doc);


                                            done(null, {success:true});
                                        } catch(major_error){
                                            console.log(major_error);
                                        }
                                    });
                                } else{
                                    done(null, {success:true});
                                }
                            });
                        });


                        console.log("Synced Dates for Leave Request ID #" + leave_request_id);
                    }

                });
                
            }
        });

        //console.log("All promises done");
        /*
        for(var i=0; i<allDates.length; i++){
            var all_dates = allDates[i];                    
            //console.log(all_dates);
            var MongoClient = require('mongodb').MongoClient;
            MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
                if(err){
                    throw(err);
                }else{
                    //console.log("Connected to MongoDB");
                    var leave_request_collection = db.collection("leave_request");
                    var filter = {leave_request_id : leave_request_id}; 

                    //leave_request_collection.update(
                    //    filter, 
                    //    { $set: {date_items:all_dates}}
                    //);

                    leave_request_collection.update(filter, { $set: {date_items:all_dates}} , {upsert:true}, function(err, result) {
                        if(err){
                            throw(err);
                            console.log(err);
                            db.close(); 
                        }else{  
                            db.close(); 
                            console.log("Synced Dates for Leave Request ID #" + leave_request_id);
                            done(null, {success:true});
                        }

                    });
                    
                }
            });
        }
        */
              
    });
    
    recursiveLeaveRequestDateGet(leave_request_id);
    

});

module.exports = syncLeaveRequestDatesQueue;