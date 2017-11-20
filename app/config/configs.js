var mysql = require('mysql');
var moment = require('moment');
var moment_tz = require('moment-timezone');


module.exports = {
	getMysql:function(){
		
		var connection = mysql.createConnection({
			host:"iweb11",
			user:"remotestaff",
			password:"i0MpD3k6yqTz",
			database:"remotestaff"
		});
		
		return connection;
	},
	
	getCouchDb:function(){
		var nano = require('nano')('http://replication:r2d2rep@iweb10:5984');
		return nano;
	},
	getMysqlCredentials:function(){
		
		var connection = {
			host:"iweb11",
			user:"remotestaff",
			password:"i0MpD3k6yqTz",
			database:"remotestaff"
		};
		
		return connection;
	},

	getMongoCredentials:function(){
		var options = { 
			server: { socketOptions: { keepAlive: 300000, connectTimeoutMS: 30000, reconnectTries: Number.MAX_VALUE  } },
			replset: { socketOptions: { keepAlive: 300000, connectTimeoutMS : 30000 } }
		};
		
		return {
			host:"iweb10",
			port:27017,
			options:options
		};
	},
	getSolrCredentials:function(){
		var credentials = {
			host: "iweb_solr",
			port: 8983
		};

		return credentials;
	},
	getAPIURL:function(){
		return "http://test.api.remotestaff.com.au";	
	},
	getEmailTemplatesPath:function(){
		return "/home/remotestaff/remotestaff/emaillayouts";
	},
	getTmpFolderPath:function(){
		return '/home/remotestaff/tmp/';
	},
	getDateToday(){
		var today = moment_tz();

		return new Date(moment_tz().format("YYYY-MM-DD HH:mm:ss"));
	},
	getPortalUrl(){
		var env = require("../config/env");
		var result = "";
		if(env.environment == "development"){
			result = "http://devs.remotestaff.com.au/portal";
		} else if(env.environment == "staging"){
			result = "http://staging.remotestaff.com.au/portal";
		} else if(env.environment == "production"){
			result = "https://remotestaff.com.au/portal";
		}
		return result;
	},
	getDefaultTimezone(){
		return "Asia/Manila";
	},
	getXeroPrivateCredentials:function(){
        var env = require("../config/env");

        privateKey = {};

        if(env.environment == "development"){
            privateKey = {
                "userAgent" : "Devs RS",
                "consumerKey": "YOHIEBTSRGGEX5HX8EHVQVQNIIXV0Q",
                "consumerSecret": "5VFZSR3RBU01KPEQMXW9PTSFAXCQLF",
                "privateKeyName": "privatekey.pem",
            };
		} else if(env.environment == "staging"){
        	//private key of staging




            privateKey = {
                "userAgent" : "Remote Staff System",
                "consumerKey": "GYEDSZFFAZ3F6MNKWBOU2YZ6DITDX0",
                "consumerSecret": "R2QDAXWDUIQMTJH9QV0KQA1MTRJPNU",
                "privateKeyName": "privatekeyprod.pem",
            };




		} if(env.environment == "production"){
            privateKey = {
                "userAgent" : "Remote Staff System",
                "consumerKey": "GYEDSZFFAZ3F6MNKWBOU2YZ6DITDX0",
                "consumerSecret": "R2QDAXWDUIQMTJH9QV0KQA1MTRJPNU",
                "privateKeyName": "privatekeyprod.pem",
			};
		}
		return privateKey;


	},
	getNABAccountXero: function() {

        var env = require("../config/env");

        var nab = "D4C4310C-18ED-40AF-AC8F-7D7EDF3501F0";

        if (env.environment == "production") {
            nab = "E0A58E94-6524-42D9-B8C8-BCA5DB92790C";
        }

        return nab;
    },
	getPAYPALAccountXero: function(){

        var env = require("../config/env");

        var paypal = "9E4F0283-2E10-4B8C-90C2-50B57223409B";

        if (env.environment == "production") {
            paypal = "72284696-BF97-4A83-B83E-0D1880E98152";
        }

        return paypal;
	}

};