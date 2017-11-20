var express = require('express');
var router = express.Router();
var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var subcontractorSchema = require("../models/Subcontractor");
var Subcontractors = require("../mysql/Subcontractors");
var mongoCredentials = configs.getMongoCredentials();

router.all("*", function(req,res,next){
	res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
});

/*
 Get all currenty working staff
 http://test.njs.remotestaff.com.au/subcontractors/currently-working
 Displayed in Website http://devs.remotestaff.com.au/staff_currently_working.php
 * */
router.all("/currently-working", function(req, res, next){
    /*
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var Subcontractor = db.model("Subcontractor", subcontractorSchema);
	var filter = { "subcontractors_detail.status":{$in:["ACTIVE", "suspended"]}};
    db.once("open", function(){
    	
    	Subcontractor.find(filter).exec(function(err, docs){
    		if(err){
    			return res.send({success:false}, 200);
    		}
    		
    		data=[];
    		for(var i=0; i<docs.length; i++){
    			data.push({
    				userid : docs[i].userid,
    				fname : docs[i].personal_detail.fname,
    				job_designation : docs[i].subcontractors_detail.job_designation
    			});
    		}
    		//console.log(docs);
    		return res.send({success:true, result : data}, 200);
    	});        
    });
	*/
	Subcontractors.getCurrentlyWorking().then(function(result){
		var result = {
			success:true,
			result:result			
		};
		return res.send(result, 200);
	}).catch(function(err){
		var result = {
			success:false,
			msg : err
		};
		return res.send(result, 200);
	});
});

router.all("/get-hourly-rate", function(req, res, next){
    if (typeof req.query.subcon_id == "undefined"){
        return res.send({success:false, errors:"Missing Subcontractors ID"});
    }
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var Subcontractor = db.model("Subcontractor", subcontractorSchema);
	
    db.once("open", function(){
        Subcontractor.findOne({subcontractors_id:parseInt(req.query.subcon_id)}).exec((err, subcontractor)=>{
            console.log(req.query.subcon_id);
            if (subcontractor==null){
                return res.send({success:false, errors:"Missing Subcontractor"}, 200);
            }else{
                return res.send({success:true, result:Math.round(subcontractor.getHourlyRate()* 100)/100}, 200);
            }
        });
    });

});
router.all("/get-daily-rate", function(req, res, next){
    if (typeof req.query.subcon_id == "undefined"){
        return res.send({success:false, errors:"Missing Subcontractors ID"});
    }
    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod");
 	var Subcontractor = db.model("Subcontractor", subcontractorSchema);
	
    db.once("open", function(){
        Subcontractor.findOne({subcontractors_id:parseInt(req.query.subcon_id)}).exec((err, subcontractor)=>{
            console.log(req.query.subcon_id);
            if (subcontractor==null){
                return res.send({success:false, errors:"Missing Subcontractor"}, 200);
            }else{
                return res.send({success:true, result:Math.round(subcontractor.getDailyRate()* 100)/100}, 200);
            }
        });
    });

});
module.exports = router;
