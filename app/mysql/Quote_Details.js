var Sequelize = require('sequelize');
var configs = require("../config/configs");
var quoteComponent = require("../components/Quote");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();


var sequelize = require("../mysql/sequelize");

var quoteDetailSchema =  sequelize.define('quote_details',{


    id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
    quote_id: {type: Sequelize.STRING},
    work_position: {type: Sequelize.STRING},
    userid: {type: Sequelize.INTEGER},
    salary: {type: Sequelize.FLOAT},
    client_timezone: {type: Sequelize.STRING},
    client_start_work_hour: {type: Sequelize.STRING},
    client_finish_work_hour: {type: Sequelize.STRING},
    lunch_start: {type: Sequelize.STRING},
    lunch_out: {type: Sequelize.STRING},
    work_start: {type: Sequelize.STRING},
    work_finish: {type: Sequelize.STRING},
    working_hours: {type: Sequelize.STRING},
    days: {type: Sequelize.STRING},
    quoted_price: {type: Sequelize.FLOAT},
    work_status: {type: Sequelize.STRING},
    currency: {type: Sequelize.STRING},
    work_description: {type: Sequelize.TEXT},
    notes: {type: Sequelize.TEXT},
    currency_fee: {type: Sequelize.FLOAT},
    currency_rate: {type: Sequelize.FLOAT},
    gst: {type: Sequelize.FLOAT},
    no_of_staff: {type: Sequelize.STRING},
    quoted_quote_range: {type: Sequelize.TEXT},
    staff_country: {type: Sequelize.STRING},
    staff_timezone: {type: Sequelize.STRING},
    staff_currency: {type: Sequelize.STRING},
    detail_status: {type: Sequelize.STRING},
    starting_date: {type: Sequelize.DATE},
    tracking_code: {type: Sequelize.STRING},
    service_fee: {type: Sequelize.STRING},
    office_fee: {type: Sequelize.STRING},
    currency_adjustment: {type: Sequelize.STRING},
    others: {type: Sequelize.STRING},
    others_description: {type: Sequelize.STRING},
    gst_apply: {type: Sequelize.STRING},
    special_arrangement_description: {type: Sequelize.TEXT},
    special_arrangement_work_status: {type: Sequelize.TEXT},
    special_arrangement_working_days: {type: Sequelize.INTEGER},
    special_arrangement_working_hrs: {type: Sequelize.INTEGER},
    special_arrangement_approval: {type: Sequelize.TEXT},
    client_work_start : {type: Sequelize.TEXT},
    staff_work_start : {type: Sequelize.TEXT},
    client_work_finish : {type: Sequelize.TEXT},
    staff_work_finish : {type: Sequelize.TEXT},
    work_status_index: {type: Sequelize.INTEGER},
    margin: {type: Sequelize.INTEGER},
    selected_start_work : {type: Sequelize.STRING}


},{

    freezeTableName : true,
    timestamps: false,
    classMethods:
    {
        getQuoteDetails:function(quote_id){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            quoteDetailSchema.findAll({


                where:
                {
                    quote_id : quote_id,
                    detail_status:'displayed'
                }


            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;
        },

        addQuoteDetails:function(params)
        {
            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            quoteDetailSchema.create({
                quote_id: params.quote_id,
                work_position: params.work_position,
                staff_country: params.staff_country,
                staff_timezone: params.staff_timezone,
                work_start: params.work_start_staff,
                work_finish: params.work_finish_staff,
                working_hours: params.working_hours,
                days: params.days,
                work_status: params.work_status,
                staff_currency: params.staff_currency,
                salary: params.salary,
                no_of_staff: params.no_of_staff,
                work_description: params.work_description,
                client_timezone: params.client_timezone,
                client_start_work_hour: params.client_start_work_hour,
                client_finish_work_hour: params.client_finish_work_hour,
                currency: params.currency,
                quoted_price: params.quoted_price,
                gst: params.gst_value,
                userid: params.userid,
                tracking_code: params.tracking_code,
                service_fee: params.service_fee,
                office_fee: params.office_fee,
                currency_adjustment: params.currency_adjustment,
                others: params.others_amount,
                others_description: params.others_description,
                gst_apply: params.apply_gst,
                special_arrangement_description: params.specialArrangement,
                special_arrangement_work_status: params.work_status_special,
                special_arrangement_working_days: params.specialArrangement_workingDays,
                special_arrangement_working_hrs: params.specialArrangement_requiredHours,
                special_arrangement_approval: params.lanceApproval,
                client_work_start : params.client_work_start,
                staff_work_start : params.staff_work_start,
                client_work_finish : params.client_work_finish,
                staff_work_finish : params.staff_work_finish,
                work_status_index: params.work_status_index,
                margin: params.margin,
                selected_start_work :params.selected_start_work,
                starting_date:params.selected_start_work
            },{isNewRecord:true}).then(function(insertedData){

                // var last_id = (insertedData.id ? insertedData.id : null );
                quoteComponent.addHistory(params.adminID,params.added,params.quote_id,'INSERT DETAILS');
                willFulfillDeferred.resolve(insertedData);
            });

            return willFulfill;

        },
        updateQuoteDetails:function(params){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            if(!params.detail_status)
            {

                quoteDetailSchema.find({

                    where :{id:params.quote_details_id}

                }).then(function(data){

                    if(data)
                    {
                        data.updateAttributes(
                            {

                                quote_id: params.quote_id,
                                work_position: params.work_position,
                                staff_country: params.staff_country,
                                staff_timezone: params.staff_timezone,
                                work_start: params.work_start_staff,
                                work_finish: params.work_finish_staff,
                                working_hours: params.working_hours,
                                days: params.days,
                                work_status: params.work_status,
                                staff_currency: params.staff_currency,
                                salary: params.salary,
                                no_of_staff: params.no_of_staff,
                                work_description: params.work_description,
                                client_timezone: params.client_timezone,
                                client_start_work_hour: params.client_start_work_hour,
                                client_finish_work_hour: params.client_finish_work_hour,
                                currency: params.currency,
                                quoted_price: params.quoted_price,
                                gst: params.gst_value,
                                userid: params.userid,
                                tracking_code: params.tracking_code,
                                service_fee: params.service_fee,
                                office_fee: params.office_fee,
                                currency_adjustment: params.currency_adjustment,
                                others: params.others_amount,
                                others_description: params.others_description,
                                gst_apply: params.apply_gst,
                                special_arrangement_description: params.specialArrangement,
                                special_arrangement_work_status: params.work_status_special,
                                special_arrangement_working_days: params.specialArrangement_workingDays,
                                special_arrangement_working_hrs: params.specialArrangement_requiredHours,
                                special_arrangement_approval: params.lanceApproval,
                                client_work_start : params.client_work_start,
                                staff_work_start : params.staff_work_start,
                                client_work_finish : params.client_work_finish,
                                staff_work_finish : params.staff_work_finish,
                                work_status_index: params.work_status_index,
                                margin: params.margin,
                                selected_start_work :params.selected_start_work,
                                starting_date:params.selected_start_work
                            },

                            {
                                where :{id:params.quote_details_id}

                            }).then(function(updatedData){

                            quoteComponent.addHistory(params.adminID,params.changes,params.quote_id,'UPDATE');
                            willFulfillDeferred.resolve(updatedData);

                        });
                    }


                });

            }
            else {

                quoteDetailSchema.update(
                    {
                        detail_status:"removed"
                    },

                    {
                        where :{id:params.quote_details_id}

                    }).then(function(updatedData){


                    quoteComponent.addHistory(params.adminID,params.deleteDesc,params.quote_id,'DELETE');
                    willFulfillDeferred.resolve(updatedData);

                });

            }


            return willFulfill;

        }

    }


});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = quoteDetailSchema;
