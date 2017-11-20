var Sequelize = require('sequelize');
var configs = require("../config/configs");
var moment = require('moment');
var Q = require('q');
var Personal_Info = require("../mysql/Personal_Info");
var Lead_Info = require("../mysql/Lead_Info");
var Time_Sheet_Details = require("../mysql/TimeSheetDetails");
var timesheetNotesSubcon = require("../mysql/TimeSheetNotesSubcon");
var subcontractorSchema = require("../mysql/Subcontractors");
var adminInfoSchema = require("../mysql/Admin_Info");

var moment = require('moment');

var timesheetNotesSubcon = require("../mysql/TimeSheetNotesSubcon");


var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");

var Timesheet = sequelize.define("timesheet", {
	id: {type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
    leads_id : {type: Sequelize.INTEGER},
    userid : {type: Sequelize.INTEGER},
	subcontractors_id : {type: Sequelize.INTEGER},
	month_year: {type: Sequelize.DATE},
	date_generated: {type:Sequelize.DATE},
	status: {type:Sequelize.STRING},
	notify_staff_invoice_generator: {type:Sequelize.STRING},
	notify_client_invoice_generator: {type:Sequelize.STRING},
}, {
	freezeTableName : true,
	timestamps: false,
	instanceMethods: {
    	getTotals: function() {
    		var me = this;
    		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

    		var timesheet_id = this.id;
    		var sql = "SELECT SUM(regular_rostered) AS sum_regular_rostered, SUM(hrs_charged_to_client) AS sum_hrs_charged_to_client, SUM(adj_hrs) AS sum_adj_hrs, SUM(diff_charged_to_client) as sum_diff_charged_to_client FROM timesheet_details WHERE timesheet_id = ?";
    		console.log(sql);
    		sequelize.query(sql, { replacements: [timesheet_id], type: sequelize.QueryTypes.SELECT }).then(function(result){
    			var output = {
    				totals:result[0],
    				timesheet:me
    			};
    			willFulfillDeferred.resolve(output);
    		});
    		return willFulfill;
    	},

		getTotalsWithDate: function(date_from, date_to) {
    		var me = this;
    		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

    		var timesheet_id = this.id;
    		var sql = "SELECT SUM(regular_rostered) AS sum_regular_rostered, SUM(hrs_charged_to_client) AS sum_hrs_charged_to_client, SUM(adj_hrs) AS sum_adj_hrs, SUM(diff_charged_to_client) as sum_diff_charged_to_client FROM timesheet_details WHERE timesheet_id = ? AND reference_date BETWEEN ? AND ?";
    		console.log(sql);
    		sequelize.query(sql, { replacements: [timesheet_id, date_from, date_to], type: sequelize.QueryTypes.SELECT }).then(function(result){
    			var output = {
    				totals:result[0],
    				timesheet:me
    			};
    			willFulfillDeferred.resolve(output);
    		});
    		return willFulfill;
    	}
  },
	classMethods:{

        getTimesheetDetailsByDetailsPageCount:function(){

            var willFulfillDeferredCount = Q.defer();
            var willFulfillCount = willFulfillDeferredCount.promise;

            Time_Sheet_Details.count({
                include: [
                    {
                        model: timesheetNotesSubcon,
                        required: true,
                        attributes:["note","file_name", "id", "working_hrs", "timestamp", "has_screenshot", "notes_category"],
												where: {
													note: {$ne: ""} ,
													id: {$ne: ""}
												}
                    },
                    {
                        model: Timesheet, attributes:["id","userid","subcontractors_id"],
                        include:[
                            {
                                model: Lead_Info, attributes:["id","fname","lname","email","hiring_coordinator_id","status"],
                                include:[{
                                    model: adminInfoSchema,
                                    required: false,
                                    attributes:["admin_id","admin_fname", "admin_lname", "admin_email", "signature_contact_nos", "signature_company"]
                                }]
                            },
                            {model:Personal_Info,attributes:["userid","fname","lname","email"]}
                        ]
                    }],
                where:{ reference_date:{$gte:"2017-01-01"}},
                order:[
                    ["id","DESC"]
                ],
                subQuery:false

            }).then(function(foundObject){
                willFulfillDeferredCount.resolve(foundObject);
            });

            return willFulfillCount;
		},

        getTimesheetDetailsByDetailsPageCountSeacrh:function(page, filters){

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            var limit = 30;

            console.log("Count Querying search timesheet..");
                var scWhere = {};
								var clientWhere = {};

								if(filters.leads_id && filters.subcon_id){
									clientWhere = {
										leads_id: filters.leads_id,
										subcontractors_id: filters.subcon_id
									};
								} else if(filters.leads_id){
									clientWhere = {
										leads_id: filters.leads_id
									};
								} else if(filters.subcon_id){
									clientWhere = {
										subcontractors_id: filters.subcon_id
									};
								}

								console.log(clientWhere);


                if(filters.sc_id && filters.is_exclude_inactive){
                    scWhere = {
                        hiring_coordinator_id: {$in: filters.sc_id},
                        status: { $notIn: ["REMOVED","Inactive"]}
                    };
                } else if(filters.sc_id){
                    scWhere = {hiring_coordinator_id: {$in: filters.sc_id}};
                } else if(filters.is_exclude_inactive){
                    scWhere = {status: { $notIn: ["REMOVED","Inactive"]}};
                }

                 Time_Sheet_Details.count({
                    include: [
                        {
                            model: timesheetNotesSubcon,
                            required: true,
                            attributes:["note","file_name", "id", "working_hrs", "timestamp", "has_screenshot", "notes_category", "userid"],
														where: {
															note: {$ne: ""} ,
															id: {$ne: ""}
														}

                        },
                        {
                            model: Timesheet,
                            attributes:["id","leads_id","userid","subcontractors_id"],
                            where:  clientWhere, // Client
                            include:[
                                {
                                    model: Lead_Info, attributes:["id","fname","lname","email","hiring_coordinator_id","status"],
                                    where:  scWhere, // SC
                                    include:[{
                                        model: adminInfoSchema,
                                        required: false,
                                        attributes:["admin_id","admin_fname", "admin_lname", "admin_email", "signature_contact_nos", "signature_company"],
                                    }]

                                },
                                {
                                    model:Personal_Info,attributes:["userid","fname","lname","email"],

                                }
                            ]
                        }],
                    where: {
                        reference_date: filters.reference_date
                    },
                    order:[
                        ["id","DESC"]
                    ],
                    offset:((page-1)*limit),
                    limit : limit,
                    subQuery:false

                }).then(function(foundObject){
                    willFulfillDeferred.resolve(foundObject);
                });

                return willFulfill;


        },

        getTimesheetDetailsByDetailsPage:function (page, filters) {

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;
            var limit = 30;


            if(filters == null){
                console.log("Querying search timesheet filters null..");
                Time_Sheet_Details.findAll({
                    offset:((page-1)*limit),
                    limit : limit,
                    include: [
                        {
                            model: timesheetNotesSubcon,
														required: true,
                            attributes:["note","file_name", "id", "working_hrs", "timestamp", "has_screenshot", "notes_category"],
														where: {
															note: {$ne: ""} ,
															id: {$ne: ""}
														}
                        },
                        {
                            model: Timesheet, attributes:["id","userid","subcontractors_id"],
                            include:[
                                {
                                    model: Lead_Info, attributes:["id","fname","lname","email","hiring_coordinator_id","status"],
                                    include:[{
                                        model: adminInfoSchema,
                                        //required: false,
                                        attributes:["admin_id","admin_fname", "admin_lname", "admin_email", "signature_contact_nos", "signature_company"]
                                    }]
                                },
                                {model:Personal_Info,attributes:["userid","fname","lname","email"]}
                            ]
                        }],
                    where: { reference_date:{$gte:"2017-01-01"}},
                    order:[
                        ["id","DESC"]
                    ],
                    subQuery:false

                }).then(function(foundObject){
                    willFulfillDeferred.resolve(foundObject);
                });
			} else {

                console.log("Querying search timesheet..");
                var scWhere = {};
				var clientWhere = {};

				if(filters.leads_id && filters.subcon_id){
					clientWhere = {
						leads_id: filters.leads_id,
						subcontractors_id: filters.subcon_id
					};
				} else if(filters.leads_id){
					clientWhere = {
						leads_id: filters.leads_id
					};
				} else if(filters.subcon_id){
					clientWhere = {
						subcontractors_id: filters.subcon_id
					};
				}

                if(filters.sc_id && filters.is_exclude_inactive){
                    scWhere = {
                        hiring_coordinator_id: {$in: filters.sc_id},
                        status: { $notIn: ["REMOVED","Inactive"]}
                    };
                } else if(filters.sc_id && filters.sc_id.length > 0){
                    scWhere = {hiring_coordinator_id: {$in: filters.sc_id}};

                } else if(filters.is_exclude_inactive){
                    scWhere = {status: { $notIn: ["REMOVED","Inactive"]}};
                }


        Time_Sheet_Details.findAll({
            include: [
                {
                    model: timesheetNotesSubcon,
                    required: true,
                    attributes:["note","file_name", "id", "working_hrs", "timestamp", "has_screenshot", "notes_category", "userid"],
										where: {
											note: {$ne: ""} ,
											id: {$ne: ""}
										}
                },
                {
                    model: Timesheet,
                    attributes:["id","leads_id","userid","subcontractors_id"],
                    where:  clientWhere, // Client
                    include:[
                        {
                            model: Lead_Info, attributes:["id","fname","lname","email","hiring_coordinator_id","status"],
                            where:  scWhere, // SC
                            include:[{
                                model: adminInfoSchema,
                                required: false,
                                attributes:["admin_id","admin_fname", "admin_lname", "admin_email", "signature_contact_nos", "signature_company"],
                            }]

                        },
                        {
                            model:Personal_Info,attributes:["userid","fname","lname","email"],
                        }
                    ]
                }],
            where: {
                reference_date: filters.reference_date
            },
            order:[
                ["id","DESC"]
            ],
            offset:((page-1)*limit),
            limit : limit,
            subQuery:false

        }).then(function(foundObject){
            willFulfillDeferred.resolve(foundObject);
        });
			}

			return willFulfill;

        },
  		getTimesheetDetails:function(id){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			Timesheet.findOne({
				include:[{model: Time_Sheet_Details, attributes:["id"]}],
				where:{
					id:id
				}
			}).then(function(foundObject){
				willFulfillDeferred.resolve(foundObject);
			});

  			return willFulfill;
		},
		getTimesheet:function(timesheet_id){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			Timesheet.findOne({
				include:[{model:Lead_Info,attributes:["id","fname","lname","email","hiring_coordinator_id","status"]},
							{model:Personal_Info,attributes:["userid","fname","lname","email"]},
							{model:subcontractorSchema,attributes:["id","staff_email"]}],
				where:{
					id:timesheet_id
				}
			}).then(function(foundObject){

				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;

		},

		fetchAllTimesheets:function(query){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			Timesheet.findAll({
				include: [
					{
						model:Lead_Info,
						attributes:["id","fname","lname","email","hiring_coordinator_id","status"],
						include: [{
							model: adminInfoSchema,
							required: false,
							attributes:["admin_id","admin_fname", "admin_lname", "admin_email", "signature_contact_nos", "signature_company"],
						}]
					},
					{model:Personal_Info,attributes:["userid","fname","lname","email"]},
					{model:subcontractorSchema,attributes:["id","staff_email"]},
					{
						model: Time_Sheet_Details,
						required: false,
						attributes:["total_hrs", "adj_hrs", "status", "id"],
						include: [{
							model: timesheetNotesSubcon,
							required: false,
							attributes:["note","file_name", "id", "working_hrs", "id"],
						}]
					}
				],
				where:query,
				// where:{
				// 	userid: 128070
				// }
			}).then(function(foundObjects){
				willFulfillDeferred.resolve(foundObjects);
			});

			return 	willFulfill;

		},
		getTimeSheetsWithNotes:function(start_date, end_date){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			this.fetchAllTimesheets(sequelize.literal('DATE(month_year) BETWEEN "' + start_date + '" AND "' + end_date + '" AND timesheet.leads_id != 11')).then(function(foundObjects){

				var items_to_return = [];

				for(var i = 0;i < foundObjects.length;i++){
					var current_item = foundObjects[i]["dataValues"];

					var timesheets_with_notes = [];

					for(var j = 0;j < current_item.timesheet_details.length;j++){
						var current_details = current_item.timesheet_details[j]["dataValues"];
						if(current_details.timesheet_notes_subcons.length > 0){
							timesheets_with_notes.push(current_details);
						}
					}


					if(timesheets_with_notes.length > 0){
						current_item.timesheet_details = timesheets_with_notes;
						// current_item.month_year = moment(current_item.month_year).format("MMM D, YYYY");

						items_to_return.push(current_item);
					}
				}


				willFulfillDeferred.resolve(items_to_return);
			});


			return 	willFulfill;
		}

	}
});

Timesheet.belongsTo(Personal_Info, {foreignKey:"userid"});
Timesheet.belongsTo(Lead_Info, {foreignKey:"leads_id"});
Timesheet.belongsTo(subcontractorSchema, {foreignKey:"subcontractors_id"});
Time_Sheet_Details.belongsTo(Timesheet, {foreignKey:"timesheet_id", constraints: false});
Timesheet.hasMany(Time_Sheet_Details, {foreignKey: "timesheet_id"});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = Timesheet;
