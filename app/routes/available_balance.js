
var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
var mysql = require("mysql");
http.post = require("http-post");
var moment = require('moment');
var mongoCredentials = configs.getMongoCredentials();
var mysqlCredentials = configs.getMysqlCredentials();

router.all("*", function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

var availableBalanceQueue = require("../bull/available_balance_queue");

router.all("/sync-available-balance",function(req,res,next){




    if(req.query.client_id){
        client_id = req.query.client_id;
        var client = {
            id: client_id
        };

        availableBalanceQueue.add({processClient:client});
    }


    res.status(200).send({success:true, result: req.query});

});



module.exports = router;