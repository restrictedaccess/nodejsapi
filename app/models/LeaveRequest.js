var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var nano = configs.getCouchDb();
var moment = require('moment');
var moment_tz = require('moment-timezone');

var fields = {
	leave_request_id:{type:Number},
    userid:{type:Number},
    leads_id:{type:Number},
    leave_type : String,
    reason_for_leave : String,    
    date_requested : Date,
    date_requested_str : String,
    date_requested_unix : Number,
    staff : String,
    client : String,
    admin : String
};


var leaveRequestSchema = new Schema(fields,
{collection:"leave_request"});




leaveRequestSchema.methods.getDateOfLeave = function(){
	var mysql_connection = configs.getMysql();
	var leave_request_id = this.leave_request_id;
	var me = this;
    console.log(leave_request_id);
	mysql_connection.connect();	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query="SELECT (d.id)AS leave_request_dates_id, d.date_of_leave,DATE_FORMAT(d.date_of_leave,'%b %d, %Y %a')AS date_of_leave_str, UNIX_TIMESTAMP(d.date_of_leave)AS date_of_leave_unix, d.status FROM leave_request_dates d WHERE leave_request_id=?;";		
	mysql_connection.query(query, [leave_request_id], function(err, records) {
		var involved_dates=[];
		for(var i=0; i<records.length; i++){
			var d = records[i];
			
			involved_dates.push({
				leave_request_dates_id : d.leave_request_dates_id,
				date_of_leave : d.date_of_leave,
				date_of_leave_str : d.date_of_leave_str,
				date_of_leave_unix : d.date_of_leave_unix,
				status : d.status
			});
		}
		me.date_items = involved_dates;
        //console.log(records);
		willFulfillDeferred.resolve(involved_dates);		
		mysql_connection.end();
	});
	
	return willFulfill;
};




leaveRequestSchema.methods.getById = function(leave_request_id, isLean, selectedFields){
    var willDefer = Q.defer();
    var willFullfill = willDefer.promise;

    if(typeof selectedFields == "undefined"){
        selectedFields = null;
    }

    if(typeof isLean == "undefined"){
        isLean = false;
    }

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
    var LeaveRequestModel = db.model("LeaveRequest", leaveRequestSchema);

    db.once("open", function(){
        var query = LeaveRequestModel.findOne({
            leave_request_id: parseInt(leave_request_id)
        });

        if(selectedFields){
            query.select(selectedFields);
        }

        if(isLean){
            query.lean();
        }


        query.exec(function(err, foundDoc){
            db.close();
            willDefer.resolve(foundDoc);
        });
    });

    return willFullfill;
};


module.exports = leaveRequestSchema;