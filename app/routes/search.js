var express = require('express');
var phpdate = require('phpdate-js');
var router = express.Router();
var configs = require("../config/configs");
var apiUrl = configs.getAPIURL();
var console = require('console');
var mongoose = require('mongoose');
var mongoCredentials = configs.getMongoCredentials();
var Q = require('q');
var http = require("http");
http.post = require('http-post');

var moment = require('moment');
var moment_tz = require('moment-timezone');

var SolrNode = require('solr-node');
var quoteMongoSchema = require("../models/QuoteModel");
var leadsInfoSchema = require("../mysql/Lead_Info");

var options = {
    host: configs.getSolrCredentials()["host"],//'127.0.0.1',
    port: configs.getSolrCredentials()["port"],// '8983',
    core: 'quote',
    protocol: 'http',
    debugLevel: 'ERROR' // log4js debug level paramter
};


router.all("*", function(req,res,next){
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});



//quote global search
router.get("/search-quote",function(req,res,next){


    options.core = "quote";

    var q = req.query.q;
    var Leads = new SolrNode(options);
    var totalRows = 50;
    var page = (req.query.page ? req.query.page : 1);

// Create query
    var strQuery = Leads.query().q('text:'+q).start((page - 1)*totalRows).rows(totalRows);
    // var filteredQuery = Leads.query().q("quote_data:"[moment(q).toDate()+" TO "+moment(q).toDate()]);
    // var objQuery = Leads.query().q({text:'test', title:'test'});
    // var myStrQuery = 'q=text:'+q+'&wt=json';


    Leads.search(strQuery, function (err, result) {

        if (err) {
            console.log(err);
            return res.status(200).send({success:false,msg:err});
        }
        return res.status(200).send({success:true,data:result.response});
    });
});


//search by date (date_quoted)(solr)
router.get("/search-quote-by-date",function(req,res,next){

    options.core = "quote";

    var Leads = new SolrNode(options);
    var totalRows = 50;
    var page = (req.query.page ? req.query.page : 1);

    var from  = (req.query.from ? req.query.from : null);
    var to = (req.query.to ? req.query.to : null);
    var text = (req.query.text ? req.query.text : null );
    var solrQuery = "";

    if(from)
    {
        from = moment(from).format('Y-M-D')+"T00:00:00Z";
    }

    if(to)
    {
        to = moment(to).format('Y-M-D')+"T23:59:59Z";
    }

    var search_date = from+" TO "+to;
    console.log(search_date);
    if(!from && !to)
    {
        return res.status(200).send({success:false,msg:"Please input date range."});
    }


    if(!text)
    {
        solrQuery = Leads.query().q('quote_data:['+search_date+']').start((page - 1)*totalRows).rows(totalRows);
    }
    else
    {
        solrQuery = 'q=text:'+text+'&fq=quote_data:['+search_date+']&wt=json';
    }
    // var filteredQuery = Leads.query().q('quote_data:['+search_date+']').start((page - 1)*totalRows).rows(totalRows);
    // var myStrQuery = 'q=text:14123&fq=quote_data:['+search_date+']&wt=json';
    Leads.search(solrQuery, function (err, result) {

        if (err) {
            console.log(err);
            return res.status(200).send({success:false,msg:err});
        }
        return res.status(200).send({success:true,data:result.response});
    });

});



//search identical candidates ( same name or last name)
router.get("/get-identical",function(req,res,next){


    options.core = "candidates";
    var fname = (req.query.fname ? req.query.fname : "" );
    var lname = (req.query.lname ? req.query.lname : "" );
    var userid = (req.query.userid ? req.query.userid : null );

    if(!userid && fname == "" && lname == "")
    {
        result = {
            success:false,
            msg:"No name to search"
        }

        return res.status(200).send(result);
    }

    var q = fname+" "+lname;
    var Candidate = new SolrNode(options);
    var page = 0;
    var total = 1000000;

    var solrQuery = "";
    var fq="";

    if(fname !== "")
    {

        fq+="fq=personal_fname:"+fname;
        if(lname !== "")
        {
            fq+="&";
        }
    }

    if(lname !== "")
    {
        fq+="fq=personal_lname:"+lname;
    }

    solrQuery = 'q=*:*&'+fq+'&fq=-id:'+userid+'&wt=json&rows:'+total;

    Candidate.search(solrQuery, function (err, result) {

        if (err) {
            console.log(err);
            return res.status(200).send({success:false,msg:err});
        }
        return res.status(200).send({success:true,data:result.response});
    });

});

module.exports = router;
