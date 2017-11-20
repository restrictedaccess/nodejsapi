var Q = require('q');
var adminInfoSchema = require("../mysql/Admin_Info");
var agentInfoSchema = require("../mysql/Agent_Info");
var quoteHistorySchema = require("../mysql/Quote_History");
var quoteSchema = require("../mysql/Quote");


var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var quoteMongoSchema = require("../models/QuoteModel");
var moment = require('moment');
var moment_tz = require('moment-timezone');
var Quote = function(){};

var env = require("../config/env");

Quote.prototype.number_format = function(number,decimals,dec_point,thousands_sep){

	var str = number.toFixed(decimals?decimals:0).toString().split('.');
	var parts = [];
	for ( var i=str[0].length; i>0; i-=3 ) {
		parts.unshift(str[0].substring(Math.max(0,i-3),i));
	}
	str[0] = parts.join(thousands_sep?thousands_sep:',');


	return str.join(dec_point?dec_point:'.');

};


Quote.prototype.generateHash = function(len){

	var chars = [0,1,2,3,4,5,6,7,8,9,'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P',
		'R','S','T','U','V','W','X','Y','Z','a','b','c','d','e','f','g','h','i','j','k','l','m',
		'n','o','p','q','r','s','t','u','v','w','x','y','z'];

	var keygen="";

	for(var i = 1 ; i <= parseInt(len) ; i ++)
	{
		keygen += chars[parseInt(Math.random() * (60 - 1) + 1)];
	}

	return keygen;


};


Quote.prototype.whosThis = function(id,type){

	var admin_id = id;
	var admin_type = type;
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	if(type=="admin")
	{
		adminInfoSchema.getAdminInfo(admin_id).then(function(data){

			willFulfillDeferred.resolve(data);


		}).catch(function(err){

			console.log(err);
			willFulfillDeferred.resolve(error);
		});

	}
	else if(type=="agent")
	{
		agentInfoSchema.getAgentInfo(admin_id).then(function(data){

			willFulfillDeferred.resolve(data);

		}).catch(function(err){

			console.log(err);
			willFulfillDeferred.resolve(error);

		});


	}
	else if(type=="personal")
	{

	}
	else
	{
		return null;
	}

	return willFulfill;
};



Quote.prototype.addHistory = function(created_by,desc,id,action)
{


	var formData={};
	var actionDesc ="";
	if(action != "CONVERT")
	{
		if(id=="")
		{
			formData.quote_id = desc;
		}
		else {
			formData.quote_id = id;
		}


		if(action == "INSERT")
		{
			actionDesc = "<strong>Generated New</strong>";
		}else if(action == "UPDATE")
		{
			actionDesc = "<strong>Changed</strong>:<br>";
		}
		else if(action == "DELETE") {

			actionDesc = "<strong>Deleted</strong> the details :<br>"
		}
		else if(action == "INSERT DETAILS")
		{
			actionDesc = "<strong>Inserted new quote details</strong>:<br>";

		}
		else if(action == "DELETE QUOTE")
		{
			actionDesc = "<strong>DELETED</strong>";

		}
		else if(action == "SEND")
		{
			actionDesc = "Service Agreement #"+desc+" <strong>sent</strong> to Client";
		}
		else if(action == "ACCEPT")
		{
			actionDesc = "Service Agreement #"+desc+" has been <strong>accepted</strong> by the client";
		}
		else {
			actionDesc = (action ? action : "");
		}



	}
	else {
		formData.quote_id = id;
		actionDesc = "QUOTE #"+id+" is <strong>converted</strong> to Service Agreement #"+desc;
	}



	this.whosThis(created_by,"admin").then(function(data_whos){

		if(data_whos)
		{
			formData.created_by = created_by;
			if(action != "CONVERT")
			{
				if(action != "UPDATE" && action != "INSERT DETAILS" && action != "DELETE" && action != "SEND" && action != "ACCEPT")
				{
					if(action != "INSERT")
					{
						action = "DELETE";
					}
					formData.desc = actionDesc +" quote - QUOTE# "+desc;
				}
				else
				{
					if(action != "UPDATE" && action != "DELETE" && action != "SEND" && action != "ACCEPT")
					{
						action= "INSERT";
						formData.desc = actionDesc+" "+desc;
					}
					else if(action == "SEND")
					{
						formData.desc = actionDesc;
					}
					else if(action == "ACCEPT")
					{
						formData.desc = actionDesc;
					}
					else {
						formData.desc = actionDesc+" "+desc;
					}

				}
			}else {
				formData.desc = actionDesc;
			}

			formData.action = action;
			quoteHistorySchema.addHistory(formData).then(function(data){
				console.log(data);
			}).catch(function(err){

				console.log(err);
			});

		}


	}).catch(function(err){
		console.log(err);
	});

}

Quote.prototype.getQuoteStatusCount = function(leads_id)
{


	var getCount = [];
	var pending = 0,New = 0,posted = 0 ,deleted = 0;

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;


	quoteSchema.getLeadsID(null,leads_id).then(function(result){

		function getStatusCount(i)
		{
			if(i < result.length)
			{
				item = willFulfillDeferred.resolve(result[i]);

				if (item.status === "posted") {
					posted = posted + 1;
				}
				else if (item.status === "deleted") {
					deleted = deleted + 1;
				}
				else if (item.status === "") {
					pending = pending + 1;
				}
				else if (item.status === "accepted") {
					New = New + 1;
				}

				getStatusCount(i + 1);


			}
			else

			{
				getCount.push({
					posted_count:posted,
					draft_count:pending,
					deleted_count:deleted,
					accepted_count:New
				});


				willFulfillDeferred.resolve(getCount);



				return willFulfill;
			}

		}


		getStatusCount(0);

	}).catch(function(err){

		return err;

	});


};




Quote.prototype.getCouchID = function(doc,isMailBox)
{
	var fs = require('fs');
	var nano = configs.getCouchDb();
	var db_name = "leads_accepted_service_agreements";
	if(isMailBox)
	{
		db_name = "mailbox";
	}
	else
	{
		db_name = "leads_accepted_service_agreements";
	}


	var db = nano.use(db_name);

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	db.insert(doc, function(err, body){
		if (err) {
			console.error(err);
			willFulfillDeferred.reject(err);
		}
		console.log(db_name);

		var couch_id = body.id;
		willFulfillDeferred.resolve(couch_id);

	});
	return willFulfill;

}


Quote.prototype.attachFiles = function(couch_id,f)
{

	var fs = require('fs');
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	var tmp_path = "";
	var target_path= "";

	if(f){

		db.get(couch_id, function(err, mailbox_doc) {
			if (err) {
				console.error(err);
				willFulfillDeferred.reject(err);
				return;
			}

			updaterev = mailbox_doc._rev;
			mailbox_doc._rev = updaterev;

			// if(!rev)
			// {
			//
			// }
			//
			// else
			// {
			// 	mailbox_doc._rev = rev;
			// }


			// console.log(mailbox_doc._rev);

			tmp_path = f.path;
			target_path = 'uploads/' + f.originalname;

			src = fs.createReadStream(tmp_path);
			dest = fs.createWriteStream(target_path);
			src.pipe(dest);
			fs.unlink(tmp_path);

			fs.readFile(target_path, function(err, data) {
				if (err) {
					console.error(err);
					willFulfillDeferred.reject(err);
					return;
				}
				mailbox_doc.sent = true;
				db.attachment.insert( couch_id, f.originalname, new Buffer(data, "binary"), 'application/octet-stream', {rev: mailbox_doc._rev}, function(err, body) {
					if (err) {
						// console.error(err);
						willFulfillDeferred.reject(err);
						return;
					}
					willFulfillDeferred.resolve(body.rev);
					console.log("File attached.");
					// console.log(body);
				});

			});

		});
	}

	return willFulfill;


}

Quote.prototype.attachPdf = function(couch_id,pdf_file)
{
	var fs = require('fs');
	var request = require('request');
	var http;

	if (env.environment=="production"){
		http = require('https');
	}else{
		http = require('http');
	}

	var nano = configs.getCouchDb();
	var db_name = "leads_accepted_service_agreements";
	var db = nano.use(db_name);

	var today = moment_tz().tz("GMT");
	var atz = today.clone().tz("Asia/Manila");
	var added_on = atz.toDate();

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;

	var pdf_name="Service_Agreement_Final_V"+(moment(added_on).year())+"-"+(moment(added_on).month()+1)
		+"-"+(moment(added_on).date())+"_"+(moment(added_on).hour())+"-"+(moment(added_on).minute())+"-"+(moment(added_on).second())+".pdf";


	var path = "/home/remotestaff/quote/"+pdf_name;


	db.get(couch_id, function(err, doc) {
		if (err) {
			console.error(err);
			willFulfillDeferred.reject(err);
		}

		updaterev = doc._rev;
		doc._rev = updaterev;


		var file = fs.createWriteStream(path);

		var request = http.get(pdf_file, function(response) {
			response.on('data', function(data){
				file.write(data)
			}).on('end', function(){
				file.end(function() {
					fs.readFile(path, function(err, data) {
						if (err) {
							console.error(err);
							willFulfillDeferred.reject(err);
						}

						db.attachment.insert( couch_id, pdf_name, new Buffer(data, "binary"), 'application/octet-stream', {rev: doc._rev}, function(err, body) {
							if (err) {
								console.error(err);
								willFulfillDeferred.reject(err);
							}
							//console.log(body);
							console.log("File attached.");
							willFulfillDeferred.resolve(pdf_name);
						});

					});
				});
			})
		});


	});
	return willFulfill;

}

Quote.prototype.updateMailbox = function(couch_id)
{
	var nano = configs.getCouchDb();
	var db_name = "mailbox";
	var db = nano.use(db_name);

	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	var me = this;

	db.get(couch_id, function(err, mailbox_doc) {
		if (err) {
			console.error(err);
			willFulfillDeferred.reject(err);
		}

		mailbox_doc.sent = false;
		db.insert( mailbox_doc, couch_id, function(err, body) {
			if (err){
				willFulfillDeferred.reject(err);
			}
			console.log("Mailbox document updated");
			willFulfillDeferred.resolve(body);
		});

	});

	return willFulfill;
}




module.exports = new Quote();



















// (function() {
//
// function number_format(number,decimals,dec_point,thousands_sep) {
// var str = number.toFixed(decimals?decimals:0).toString().split('.');
// var parts = [];
// for ( var i=str[0].length; i>0; i-=3 ) {
// parts.unshift(str[0].substring(Math.max(0,i-3),i));
// }
// str[0] = parts.join(thousands_sep?thousands_sep:',');
// return str.join(dec_point?dec_point:'.');
// }
//
//
// module.exports.number_format = number_format;
//
// })();
