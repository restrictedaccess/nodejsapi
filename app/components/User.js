var Q = require('q');
var configs = require("../config/configs");

// much more concise declaration
function User(db) {
    this.db = db;
    //this.name=n;
}

// You need to assign a new function here
User.prototype.findOne = function (email, password, fn) {
    // some code here
};


User.prototype.getAllClients = function(){
	db = this.db;
	db.connect();
	
	var willFulfillDeferred = Q.defer();
	var willFulfill = willFulfillDeferred.promise;
	
	var query = "SELECT s.id, s.userid, s.staff_email, p.fname, p.lname FROM subcontractors s JOIN personal p ON p.userid = s.userid WHERE s.status IN ('ACTIVE', 'suspended') AND s.leads_id = ? ORDER BY p.fname, p.lname";
	db.query(query, [id], function(err, rows) {		
		if (err){
			willFulfillDeferred.reject(err);
		}
		
		willFulfillDeferred.resolve(rows);
      	mysql_connection.end();
	});
	
	return willFulfill;
};

User.prototype.getClient = function(id, callback) {
	
	db = this.db;
	db.connect();
	
	db.query('SELECT id, fname, lname, email, mobile, officenumber FROM leads WHERE id = ?',[id],function(err,rows){
        if(err)
            console.log("Error Selecting : %s ",err );
 
        callback(rows);
		db.end();                      
    });

};

User.prototype.getApplicant = function(id, callback){
	db = this.db;
	db.connect();
	
	db.query('SELECT (userid)AS id, fname, lname, email FROM personal WHERE userid = ?',[id],function(err,rows){
        if(err)
            console.log("Error Selecting : %s ",err );
 
        callback(rows);
		db.end();                      
    });
		
};


User.prototype.getAdmin = function(id, callback){
	db = this.db;
	db.connect();
	
	db.query('SELECT (admin_id)AS id, (admin_fname)AS fname, (admin_lname)AS lname, (admin_email)AS email FROM admin WHERE admin_id = ?',[id],function(err,rows){
        if(err)
            console.log("Error Selecting : %s ",err );
 
        callback(rows);
		db.end();                      
    });
};


User.prototype.getClientSettings = function(id, callback){
	db = this.db;
	var collection = db.get('client_settings');
    collection.find({client_id : parseInt(id)},{},function(e,docs){
        //res.render('userlist', {
        //    "userlist" : docs
        //});
        callback(docs);
    });
	
};

User.prototype.getClientRunningBalance = function(item, callback){
	var nano = configs.getCouchDb();
	var db_name = "client_docs";
  	var couch_db = nano.use(db_name);
  	
	var queryOptions = {key : parseInt(item.client_id)};
	console.log(item.client_id);
	
	//function sleepFor( sleepDuration ){
 	//    var now = new Date().getTime();
    //	while(new Date().getTime() < now + sleepDuration){ /* do nothing */ } 
	//}
	
	//sleepFor(10000);
	 	 
	couch_db.view('client','running_balance', queryOptions, function(err, view) {
		var running_balance = 0;
    	if (typeof view.rows[0] != "undefined"){    	
    		running_balance = view.rows[0].value;
    	}
    	item.running_balance = parseFloat(running_balance);
    	
    	//sleepFor(3000);
    	callback(item);
	});
	
};


// no need to overwrite `exports` ... since you're replacing `module.exports` itself
module.exports = User;


