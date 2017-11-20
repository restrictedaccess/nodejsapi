var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");


var SolrNode = require('solr-node');
var env = require("../config/env");

var options = {
    host: configs.getSolrCredentials()["host"],//'127.0.0.1',
    port: configs.getSolrCredentials()["port"],// '8983',
    core: 'quote',
    protocol: 'http',
    debugLevel: 'ERROR' // log4js debug level paramter
};

var moment = require('moment');
var moment_tz = require('moment-timezone');
var Queue = require('bull');

var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

var quoteMongoSchema = require("../models/QuoteModel");
var leadsInfoSchema = require("../mysql/Lead_Info");

var leadsQueue = Queue("leads", 6379, '127.0.0.1');


leadsQueue.process(function(job, done){
    console.log("Starting bull process...");

    function delay() {
        return Q.delay(100);
    }


    var Leads = new SolrNode(options);

    var leads = {};
    leads.content = "";
    var leads_id = (typeof job.data.leads_id != "undefined" ? job.data.leads_id  : null);
    var pageLimit = 150;


    var countPromise = leadsInfoSchema.countSolr(leads_id);
    var promise = [];
    var output = [];
    var pageCount = null;


    function extractContent(leads){
        var content_to_save = [];

        //fetch content
        var object_keys = Object.keys(leads);

        object_keys.forEach(function(value){
            content_to_save.push(leads[value]);
        });

        return content_to_save;
    }

    countPromise.then(function(count){

        console.log(count);

        function fetchLeads(PAGE)
        {
            if(((PAGE-1)*pageLimit) <= count)
            {
                params={page:PAGE,limit:pageLimit,leads_id:leads_id};
                var getLeadsDataPromise = leadsInfoSchema.idForSolrSync(params);
                getLeadsDataPromise.then(function(leads_data){

                   if(typeof leads_data != "undefined" || leads_data )
                   {
                       if(leads_data.length > 0)
                       {
                           for(var index = 0 ; index < leads_data.length ; index++) {

                               the_data = leads_data[index];
                               the_data.sync = true;
                               var per_quote_promise = [];
                               var quote_promise = the_data.getQuoteMongo();

                               per_quote_promise.push(quote_promise);
                               per_quote_promise.push(delay);

                               per_quote_promises_promise = Q.allSettled(per_quote_promise);
                               promise.push(per_quote_promises_promise);
                               promise.push(delay);
                           }

                       }
                       else
                       {

                           var per_quote_promise = [];
                           var quote_promise = leads_data.getQuoteMongo();


                           per_quote_promise.push(quote_promise);
                           per_quote_promise.push(delay);

                           per_quote_promises_promise = Q.allSettled(per_quote_promise);
                           promise.push(per_quote_promises_promise);
                           promise.push(delay);


                       }// with leads id

                       var allPromise = Q.all(promise);
                       allPromise.then(function (results) {

                           if(leads_data.length > 0){

                               function getLead(x) {
                                   if (x < leads_data.length) {
                                       item_leads = leads_data[x];
                                       output.push(item_leads.structLeadsData());
                                       getLead(x + 1);
                                   }
                                   else {
                                       fetchLeads(PAGE + 1);
                                   }
                               }

                               getLead(0);
                           }
                           else
                           {
                               output.push(leads_data.structLeadsData());
                               fetchLeads(PAGE + 1);
                           }
                       });
                   }
                   else
                   {
                       fetchLeads(PAGE + 1);
                   }

                });//get Leads promise
            }//if page is less than totalCount
            else
            {
                if(output.length > 0)
                {
                    function getOutput(again) {
                        console.log("Syncing# "+again);
                        if (again < output.length) {

                            leads = {};
                            leads.content = "";

                            data = output[again];

                            data_lead = data.leads;
                            data_quote = data.quote_data

                            leads.id = (data_lead.id ? data_lead.id : null);
                            leads.fname = (data_lead.fname ? data_lead.fname : "");
                            leads.lname = (data_lead.lname ? data_lead.lname : "");
                            leads.fullName = leads.fname+" "+leads.lname;
                            leads.email = (data_lead.email ? data_lead.email : "");
                            leads.mobile = (data_lead.mobile ? data_lead.mobile : "");
                            leads.status = (data_lead.status ? data_lead.status : "");
                            var content_to_save = extractContent(leads);

                            if(data_quote.length > 0)
                            {
                                leads.quote_data = [];
                                leads.quote_data_status = [];
                                leads.sa_data_status = [];
                                data_quote.forEach(function(item){
                                    leads.quote_data.push(moment(item.date_quoted).toDate());
                                    leads.quote_data_status.push(item.status);
                                    content_to_save.push(moment(item.date_quoted).toDate());
                                    content_to_save.push(item.quote_id);
                                    content_to_save.push(item.status);
                                    if(item.quote_details.length > 0)
                                    {
                                        item.quote_details.forEach(function(details){
                                            content_to_save.push(details.work_position);
                                            content_to_save.push(details.userid);
                                            content_to_save.push(details.salary);
                                            content_to_save.push(details.tracking_code);
                                        });
                                    }
                                    if(item.service_agreement.length > 0)
                                    {
                                        item.service_agreement.forEach(function(details){
                                            leads.sa_data_status.push(details.accepted);
                                        });
                                    }

                                });
                            }

                            leads.content = content_to_save.join(" ");

                            //
                            // getOutput(again+1);
                            function saveToSolr(retries)
                            {

                                if(retries >= 10){
                                    console.log("Failed to save after 10 attempts");
                                    done(null,{success:true});
                                    return true;
                                }

                                Leads.update(leads,function(err,result){
                                    if (err) {
                                        done(null,{success:true});
                                        console.log(err);
                                    }
                                    if(result){
                                        if(result.responseHeader.status == 500 || result.responseHeader.status == 503){
                                            saveToSolr(++retries);
                                        } else {
                                            if(!data_lead.id)
                                            {
                                                getOutput(again+1);
                                            }
                                            else
                                            {
                                                leadsInfoSchema.saveSolr(data_lead.id).then(function(data){
                                                    console.log(data);
                                                    getOutput(again+1);
                                                });
                                            }



                                        }
                                    }

                                });
                            }

                            saveToSolr(0)
                        }
                        else {
                            done(null,{success:true});
                            console.log("Synced!");
                        }
                    }

                    getOutput(0);
                }
                else
                {
                    done(null,{success:true});
                   console.log('No data synced!');
                }
            }
        }


        if(count <=0)
        {
            if(leads_id)
            {
                leadsInfoSchema.delSolr(leads_id).then(function(data){
                    console.log(data);
                    count = 1;
                    fetchLeads(1);
                });
            }
            else
            {
                done(null,{success:true});
                console.log('All synced!');
            }
        }
        else
        {
            // done();
            fetchLeads(1);
        }
    }).catch(function(err){
        done(null,{success:true});
        cosnole.log(err);
    });

    //done(null,{success:true});
});

module.exports = leadsQueue;