var Q = require('q');



var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var quoteMongoSchema = require("../models/QuoteModel");
var moment = require('moment');
var moment_tz = require('moment-timezone');


var env = require("../config/env");


// much more concise declaration
function Client() {

}
/**
 *
 *
 *
 *
 *
 function get_client_managers_emails($leads_id, $userid){
	global $db;

	//get the subcon id of the staff
	$sql = $db->select()
	    ->from('subcontractors', 'id')
		->where('leads_id =?', $leads_id)
		->where('userid =?', $userid)
		->where('status =?', 'ACTIVE');
	$subcon_id = $db->fetchOne($sql);

	//get the client's active managers
	$sql = $db->select()
	    ->from('client_managers')
		->where('leads_id =?', $leads_id)
		->where('status =?', 'active')
		->where('manage_leave_request =?', 'Y');
	$managers = $db->fetchAll($sql);

	$data=array();
	$specific_id="";
	foreach($managers as $manager){
		if($manager['view_staff'] == 'specific'){
			$sql = $db->select()
			    ->from('client_managers_specific_staffs', 'id')
				->where('client_manager_id =?', $manager['id'])
				->where('subcontractor_id =?', $subcon_id);
			$specific_id = $db->fetchRow($sql);
			if($specific_id !=""){
				if(in_array($manager['email'], $data) == false){
					array_push($data, $manager['email']);
				}
			}
		}

		if($manager['view_staff'] == 'all'){
			if(in_array($manager['email'], $data) == false){
				array_push($data, $manager['email']);
			}
		}
	}

	return $data;

}
 */


Client.prototype.get_client_managers_emails = function(leads_id, userid){

    var willDefer = Q.defer();

    var Subcontractors = require("../mysql/Subcontractors");
    var ClientManagers = require("../mysql/ClientManagers");
    var ClientManagersSpecificStaffs = require("../mysql/ClientManagersSpecificStaffs");


    Subcontractors.findOne({
        attributes:	["id"],
        where:
            {
                leads_id:leads_id,
                userid: userid,
                status: "ACTIVE"
            }
    }).then(function(foundSubcon){
        if(foundSubcon){
            var subcon_id = foundSubcon.id;



            ClientManagers.findAll({
                where:{
                    leads_id: leads_id,
                    status: 'active',
                    manage_leave_request: "Y"
                }
            }).then(function(foundClientManagers){
                if(foundClientManagers.length > 0){

                    var data = [];
                    var specific_id = "";

                    var all_email_fetching_promises = [];

                    function fetchEmails(manager){
                        var fetchingDefer = Q.defer();

                        if(manager.view_staff == "specific"){
                            ClientManagersSpecificStaffs.findOne({
                                where:{
                                    client_manager_id: manager.id,
                                    subcontractor_id: subcon_id
                                }
                            }).then(function(foundSpecificClientManager){

                                if(foundSpecificClientManager){
                                    fetchingDefer.resolve(manager.email);
                                } else{
                                    fetchingDefer.resolve(null);
                                }
                            });
                        } else if(manager.view_staff == "all"){
                            fetchingDefer.resolve(manager.email);
                        } else{
                            fetchingDefer.resolve(null);
                        }

                        return fetchingDefer.promise;
                    }


                    for(var i = 0;i < foundClientManagers.length;i++){
                        var manager = foundClientManagers[i];
                        all_email_fetching_promises.push(fetchEmails(manager));
                    }

                    Q.allSettled(all_email_fetching_promises).then(function(results){

                        for(var i = 0;i < results.length;i++){
                            var result = results[i];

                            if(result.value){
                                if(data.indexOf(result.value) == -1){

                                    data.push(result.value);
                                }
                            }
                        }

                        willDefer.resolve(data);
                    });


                } else{
                    willDefer.resolve(null);
                }
            });


        } else{
            willDefer.resolve(null);
        }
    });

    return willDefer.promise;
};


Client.prototype.getCouchClientSettings = function(client_id){

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;

    function pad(num, size) {
        var s = num+"";
        while (s.length < size) s = "0" + s;
        return s;
    }


    var nano = configs.getCouchDb();
    var client_docs_couch_db = nano.use("client_docs");

    var date_now = new Date();
    var client_settings_view = client_docs_couch_db.view("client", "settings",
        {
            // key: client_id
            startkey: [client_id, [date_now.getFullYear(), pad(date_now.getMonth() + 1), pad(date_now.getDate()), date_now.getHours(), date_now.getMinutes(), 0, 0]],
            endkey: [client_id, [2011,0,0,0,0,0,0]],
            descending: true,
            limit: 1
        }, function(err, body) {
            if (!err) {

                var data_to_return = null;

                var currency_code = "";
                var currency_gst_apply = "";
                var days_before_suspension = "0";
                var currency_sign = "";
                var override_hours_per_invoice = null;
                var couch_id = null;



                var fetch_original_doc_defer = Q.defer();
                var fetch_original_doc_promise = fetch_original_doc_defer.promise;

                var doc = null;

                if (body.rows[0]) {
                    couch_id = body.rows[0].id;
                    currency_code = body.rows[0].value[0];
                    currency_gst_apply = body.rows[0].value[1];

                    /*
                     sql=db.select()
                     .from("currency_lookup", "sign")
                     .where("code =?", currency_code);
                     currency_sign = db.fetchOne(sql);
                     */
                    try {
                        client_docs_couch_db.get(body.rows[0].id, function(err, fetched) {
                            if (!err) {
                                doc = fetched;
                            }
                            fetch_original_doc_defer.resolve(doc);
                        });

                    } catch (error) {
                        //echo "Something weird happened: ".e.getMessage()." (errcode=".e.getCode().")\n";
                        //exit(1);
                        //do nothing
                        days_before_suspension = "0";
                        override_hours_per_invoice = "";
                    }
                } else{
                    fetch_original_doc_defer.resolve(null);
                }


                fetch_original_doc_promise.then(function(fetchedDoc){
                    if(doc){

                        if (typeof doc.days_before_suspension != "undefined") {
                            if (doc.days_before_suspension) {
                                days_before_suspension = doc.days_before_suspension;
                            }
                        } else {
                            days_before_suspension = "0";
                        }

                        if (doc.override_hours_per_invoice) {
                            override_hours_per_invoice = doc.override_hours_per_invoice;
                        } else {
                            override_hours_per_invoice = null;
                        }

                    } else{

                        days_before_suspension = "0";
                        override_hours_per_invoice = "";
                    }


                    var data = [];
                    if (override_hours_per_invoice) {
                        var keys = Object.keys(override_hours_per_invoice);
                        for(var i = 0;i < keys.length;i++){
                            var key = keys[i];
                            var value = override_hours_per_invoice[key];
                            data.push({subcon_id: key, total_hours: value.total_hours});
                        }

                    }

                    var data_to_return = {
                        currency_code: currency_code,
                        currency_gst_apply: currency_gst_apply,
                        days_before_suspension: ""+days_before_suspension,
                        currency_sign: currency_sign,
                        override_hours_per_invoice: data,
                        doc_id: couch_id
                    };
                    console.log("Client's Settings fetched");
                    console.log(data_to_return);
                    willFulfillDeferred.resolve(data_to_return);

                });



            } else {
                console.log("Error fetching from client_docs [client, settings]");
                console.log(err);
                fetch_client_currency_settings_defer.resolve(client_settings);
            }
        });

    return willFulfill;
};




// no need to overwrite `exports` ... since you're replacing `module.exports` itself
module.exports = Client;