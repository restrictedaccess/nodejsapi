var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var Q = require('q');
var http = require("http");
http.post = require("http-post");


//import ClientsSchema
var clientSchema = require("../models/Client");

var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

router.all("/send", (req,res,next) => {
    return res.send({success:true}, 200);
});

module.exports = router;