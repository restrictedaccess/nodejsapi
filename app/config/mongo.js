var MongoClient = require('mongodb').MongoClient;

module.export = {
	processMongoDB:function(db, processFunction){
		MongoClient.connect("mongodb://iweb10:27017/"+db, processFunction);	
	}
};
