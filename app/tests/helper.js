var Q = require("q");
var moment = require("moment");
var moment_range = require("moment-range");
var business = require('moment-business');
require('moment-weekday-calc');

var mongoose = require('mongoose');
var configs = require("../config/configs");

var mongoCredentials = configs.getMongoCredentials();

module.exports = {
    mockPath: function(){

        var mock = require('mock-require');
        mock('fs', {
            readFileSync: function(/**/){
                console.log("Path fetched:");
                console.log(arguments);
                return arguments;
            }
        });

        mock('path', {
            join: function(/**/){
                console.log("Path joined:");
                console.log(arguments);
            }
        });

    },
    migrateAll:function(){
		
		var willdefer = Q.defer();
		var willFullfill = willdefer.promise;

		var exec = require('child_process').exec;
		var cmdMysql = "cd /home/vagrant/app && sequelize db:migrate";
		exec(cmdMysql, function(error, stdout, stderr) {
			console.log(stderr);
			console.log(stdout);
			console.log(error);
			//done();
			willdefer.resolve(stdout);
		});

		return willFullfill;
    },
	revertAll:function(){
		var willdefer = Q.defer();
		var willFullfill = willdefer.promise;

		var exec = require('child_process').exec;
		var cmdMysql = "cd /home/vagrant/app && sequelize db:migrate:undo:all";
		exec(cmdMysql, function(error, stdout, stderr) {
			console.log(stderr);
			console.log(stdout);
			console.log(error);
			// done();
			willdefer.resolve(stdout);
		});
		return willFullfill;
	},
    createSqlObject:function(schema, data){
        var willDefer = Q.defer();
        var willFullfill = willDefer.promise;

        schema.build(data).save().then(function (savedItem) {
            console.log("Saved sql object!");
            console.log(schema.toString());
            willDefer.resolve(savedItem);
        }).catch(function (error) {
            console.log("Error sql object creation");
            console.log(error);
            willDefer.resolve(null);
        });

        return willFullfill;
    },
    createMongoObject:function(databaseName, modelName, schema, data){
        var willDefer = Q.defer();
        var willFullfill = willDefer.promise;

        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/" + databaseName);
        var CreatedModel = db.model(modelName, schema);

        db.once("open", function(){
            var data_to_save = new CreatedModel(data);

            data_to_save.save(function(err){
                db.close();
                if (err){
                    console.log("Error saving mongo object!");
                    console.log(err);
                    willDefer.resolve(null);
                }
                console.log("Saving mongo object successful!");
                console.log(schema.toString());
                willDefer.resolve(data_to_save);
            });
        });


        return willFullfill;
    },
    /**
     *
     * @param data The timesheet data
     * @param details_status Possible values: (locked, open)
     * @param total_adj_hrs The total adjusted hours to create, will randomly disperse from regular_rostered to +4 or -1
     * @param regular_rostered The regular_rostered to save (8.00 if full time or 4.00 if part time)
     */
    generate_timesheet:function(data, details_status, total_adj_hrs, regular_rostered){

        var willDefer = Q.defer();
        var willFullfill = willDefer.promise;

        var timesheetDefer = Q.defer();
        var willFullfillTimesheetPromise = timesheetDefer.promise;

        var timesheetSchema = require("../mysql/Timesheet");
        var timesheetDetailsSchema = require("../mysql/TimeSheetDetails");

        var current_timesheet = null;
        var timesheet_details = [];


        timesheetSchema.build(data).save().then(function (savedItem) {
            console.log("Saved sql object!");
            console.log(timesheetSchema.toString());
            current_timesheet = savedItem;
            timesheetDefer.resolve(savedItem);
        }).catch(function (error) {
            console.log("Error sql object creation");
            console.log(error);
            timesheetDefer.resolve(null);
        });

        willFullfillTimesheetPromise.then(function(result){
            var all_details_saving_promise = [];

            var startDate = moment.utc(data.month_year);
            var endDate = moment(startDate).endOf('month');
            var range = moment.range(startDate, endDate);
            var numOfBusinessDays = moment().weekdayCalc(
                new Date(moment(startDate).format("D MMM YYYY")),
                new Date(moment(endDate).format("D MMM YYYY")),
                [1,2,3,4,5]
            );
            console.log(startDate.format("YYYY-MM-DD HH:mm:ss"));
            console.log(endDate.format("YYYY-MM-DD HH:mm:ss"));
            console.log(numOfBusinessDays);

            var default_adj_hr = (total_adj_hrs / numOfBusinessDays);

            default_adj_hr = parseFloat(default_adj_hr.toFixed(2));

            var total_adj_hours_from_business_days = numOfBusinessDays * default_adj_hr;

            total_adj_hours_from_business_days = parseFloat(total_adj_hours_from_business_days.toFixed(2));

            var diff_business_days_to_total_adj_hrs = total_adj_hrs - total_adj_hours_from_business_days;

            diff_business_days_to_total_adj_hrs = parseFloat(diff_business_days_to_total_adj_hrs.toFixed(2));




            var current_day = 1;

            function createDetails(details_data){
                var savingDefer = Q.defer();
                var savingPromise = savingDefer.promise;


                timesheetDetailsSchema.build(details_data).save().then(function (savedItem) {
                    console.log("Saved sql object!");
                    console.log(timesheetDetailsSchema.toString());
                    savingDefer.resolve(savedItem);
                }).catch(function (error) {
                    console.log("Error sql object creation");
                    console.log(error);
                    savingDefer.resolve(null);
                });

                return savingPromise;
            }




            for (var month of range.by('days')) {

                var day = month.day();

                var isWeekend = (day == 6) || (day == 0);

                var current_month = month.format('YYYY-MM-DD');

                var random_adj_hour = 0.00;
                var current_regular_rostered = 0.00;
                var hrs_to_be_subcon = 0.00;
                var diff_paid_vs_adj_hrs = 0.00;
                if(!isWeekend){
                    random_adj_hour = parseFloat(default_adj_hr);
                    if(current_day == 1){
                        random_adj_hour = parseFloat(random_adj_hour) + parseFloat(diff_business_days_to_total_adj_hrs);
                    }
                    random_adj_hour = parseFloat(random_adj_hour.toFixed(2));

                    current_regular_rostered = regular_rostered;
                    hrs_to_be_subcon = random_adj_hour;
                }

                var diff_charged_to_client = random_adj_hour - regular_rostered;
                diff_paid_vs_adj_hrs = random_adj_hour - hrs_to_be_subcon;

                var details_data = {
                    timesheet_id : current_timesheet.id,
                    day: current_day,
                    total_hrs: null,
                    adj_hrs: random_adj_hour,
                    regular_rostered: current_regular_rostered,
                    hrs_charged_to_client: current_regular_rostered,
                    diff_charged_to_client: parseFloat(diff_charged_to_client.toFixed(2)),
                    hrs_to_be_subcon: hrs_to_be_subcon,
                    diff_paid_vs_adj_hrs: parseFloat(diff_paid_vs_adj_hrs.toFixed(2)),
                    status: details_status,
                    reference_date: current_month,
                };


                all_details_saving_promise.push(createDetails(details_data));
                ++current_day;

            }


            Q.allSettled(all_details_saving_promise).then(function(results){
                willDefer.resolve(results);
            });

        });

        return willFullfill;

    },
    getBusinessDays:function(date,days){
        var willDefer = Q.defer();
        var willFullfill = willDefer.promise;
        date = moment(date);
        function evaluateDays(i)
        {
            if(i < days)
            {
                date = date.add(1, 'days');
                if (date.isoWeekday() !== 6 && date.isoWeekday() !== 7) {
                    days -= 1;
                }
                evaluateDays(i);
            }
            else
            {
                willDefer.resolve(moment(date).format('YYYY-MM-DD'));
            }
        }
        evaluateDays(0);
        return willFullfill;
    },
    mongoDropCollection:function(collectionName){
        var willdefer = Q.defer();
        var willFullfill = willdefer.promise;
        var Db = require("mongodb").Db;
        var Server = require("mongodb").Server;
        var options = {
            server: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } },
            replset: { socketOptions: { keepAlive: 1, connectTimeoutMS: 30000 } }
        };
        var db = new Db('prod', new Server("127.0.0.1", 27107, options));
        db.open(function(err){
            var collection = db.collection(collectionName);
            collection.drop(function(err, reply){
                console.log(err);
                console.log(reply);
                willdefer.resolve(reply);
            });
        });
        return willFullfill;
    },
    mongoDropDb:function(dbName){
        var willdefer = Q.defer();
        var willFullfill = willdefer.promise;

        var exec = require('child_process').exec;
        var mongoQuery = 'mongo '+dbName+' --eval "db.dropDatabase()"';
        exec(mongoQuery, function(error, stdout, stderr) {

            // done();
            willdefer.resolve(stdout);
        });
        return willFullfill;
    },
    mongoDropInvoiceModification:function(){
        var willdefer = Q.defer();
        var willFullfill = willdefer.promise;

        var exec = require('child_process').exec;
        var mongoQuery = "mongo && use prod && db.invoice_modifications.drop()";
        exec(mongoQuery, function(error, stdout, stderr) {
            console.log(stderr);
            console.log(stdout);
            console.log(error);
            // done();
            willdefer.resolve(stdout);
        });
        return willFullfill;
    },
    revertCouchDb:function(dbName){
        var willdefer = Q.defer();
        var willFullfill = willdefer.promise;
        console.log("Reverting " + dbName);

        var exec = require('child_process').exec;
        var excluded_docs_from_cd = [
            "mailbox"
        ];
        var cmdCouch = "";
        if(excluded_docs_from_cd.indexOf(dbName) === -1){
            cmdCouch += "cd /vagrant/configs/couchdb/design_documents/" + dbName + " && ";
        }
        cmdCouch += "curl -X DELETE http://replication:r2d2rep@127.0.0.1:5984/" + dbName + " " +
            "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/" + dbName;

        if(dbName == "client_docs"){
            cmdCouch += " && curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/client --data-binary @client.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/invoice --data-binary @invoice.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/nab --data-binary @nab.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/orders_processing --data-binary @orders_processing.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/reports --data-binary @reports.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/running_balance --data-binary @running_balance.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/client_docs/_design/timerecord --data-binary @timerecord.json";
        } else if(dbName == "rssc"){
            cmdCouch += " && curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/connected --data-binary @connected.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/dashboard --data-binary @dashboard.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/email_notification --data-binary @email_notification.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/prepaid_monitoring --data-binary @prepaid_monitoring.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/staff --data-binary @staff.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc/_design/workflow --data-binary @workflow.json";
        } else if(dbName == "rssc_time_records"){
            cmdCouch += " && curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/hourly_rate --data-binary @hourly_rate.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/logged_in --data-binary @logged_in.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/mysql --data-binary @mysql.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/prepaid --data-binary @prepaid.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/reports --data-binary @reports.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/rssc_reports --data-binary @rssc_reports.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/rssc_time_records --data-binary @rssc_time_records.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/subcon_management --data-binary @subcon_management.json " +
                "&& curl -X PUT http://replication:r2d2rep@127.0.0.1:5984/rssc_time_records/_design/summary --data-binary @summary.json";
        }

        cmdCouch += " && sudo service couchdb restart";


        exec(cmdCouch, function(error, stdout, stderr) {
            console.log(stderr);
            console.log(stdout);
            console.log(error);
            // done();
            willdefer.resolve(stdout);  ``
        });

        return willFullfill;
    },
    
    
  
}