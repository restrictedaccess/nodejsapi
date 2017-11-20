var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var mongoCredentials = configs.getMongoCredentials();

var leadInfoSchema = require("../mysql/Lead_Info");
var personalInfoSchema = require("../mysql/Personal_Info");
var sequelize = require("../mysql/sequelize");

var Subcontractors = sequelize.define('subcontractors',{
	id:{type: Sequelize.INTEGER,primaryKey:true,autoIncrement: true},
	job_designation: {type: Sequelize.STRING},
	leads_id: {type: Sequelize.INTEGER},
	userid: {type: Sequelize.INTEGER},
	staff_email: {type: Sequelize.STRING},
	client_price:{type: Sequelize.FLOAT},
	work_status: {type: Sequelize.STRING},
	resignation_date: {type: Sequelize.DATE},
	date_terminated: {type: Sequelize.DATE},
	starting_date: {type: Sequelize.DATE},
	end_date: {type: Sequelize.DATE},
	status: {type: Sequelize.STRING},
	reason: {type: Sequelize.STRING},
		prepaid: {type: Sequelize.STRING},
		overtime: {type: Sequelize.STRING},
        current_rate: {type: Sequelize.STRING},
},
	{

	 freezeTableName : true,
	 timestamps: false,
	 classMethods:
	 {
		 fetchClientDailyRate:function(client_id){
			 var willFulfillDeferred = Q.defer();
			 var willFulfill = willFulfillDeferred.promise;

			 Subcontractors.findAll({

				 attributes:[
					 "client_price",
					 "id"
				 ],
				 where:
				 {
					 leads_id:client_id,
					 status:{
						 $in: ['ACTIVE','suspended']
					 }
				 }
			 }).then(function(foundObjects){
				var total_daily_rate = 0;
				 if(foundObjects){
					 for(var i = 0;i < foundObjects.length;i++){
						 var subcon = foundObjects[i];
						 var client_price = parseFloat(subcon["client_price"]);

						 var daily_rate_per_staff = (((client_price * 12) / 52) / 5 );
						 total_daily_rate = parseFloat(total_daily_rate) + parseFloat(daily_rate_per_staff);
					 }
				 }

				 willFulfillDeferred.resolve(total_daily_rate);
			 });


			 return willFulfill;
		 },
		 fetchActiveClientStaffCount:function(client_id){
			 var willFulfillDeferred = Q.defer();
			 var willFulfill = willFulfillDeferred.promise;

			 Subcontractors.count({
				 where:
				 {
					 leads_id:client_id,
					 status:{
						 $in: ['ACTIVE','suspended']
					 }
				 }
			 }).then(function(countObject){
				 willFulfillDeferred.resolve(countObject);
			 });


			 return willFulfill;
		 },

		 getRSEmploymentHistory:function(userid){
			 var willFulfillDeferred = Q.defer();
			 var willFulfill = willFulfillDeferred.promise;

			 Subcontractors.findAll({
				 include: [{
					 model: leadInfoSchema,
					 attributes: ["fname", "lname"]
				 }],
				 where:
				 {
					 userid:userid,
					 status:{
						 $in: ['ACTIVE','resigned','terminated','suspended']
					 }
				 }
			 }).then(function(foundObjects){
				 willFulfillDeferred.resolve(foundObjects);
			 });


			 return willFulfill;
		 },
		getCurrentlyWorking:function(){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var sql = "SELECT s.userid, LOWER(p.fname)AS fname, LOWER(s.job_designation)AS job_designation FROM subcontractors s "
					+"JOIN personal p ON p.userid = s.userid "
					+"WHERE s.status IN('ACTIVE', 'suspended') ";

			sequelize.query(sql, { type: sequelize.QueryTypes.SELECT}).then(function(data) {				
				willFulfillDeferred.resolve(data);
			});

			return willFulfill;	
		},
		
	 	getActiveContracts:function(userid){
	 		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

	 		Subcontractors.findAll({
	 			attributes:	['id','leads_id','job_designation','staff_email'],
	 			where:
	 			{
	 			  userid:userid,
	 			  status:"ACTIVE"
	 			}
	 		}).then(function(foundObject){
				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;

	 	},
	 	
	 	getSubconInfo:function(subcontractors_id){
	 		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

	 		Subcontractors.findOne({
	 			attributes:	["userid", "leads_id", "client_price", "work_status", "job_designation"],
	 			where:
	 			{
	 			  id:subcontractors_id
	 			}
	 		}).then(function(foundObject){
				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;
	 	},
	 	
	 	getClientInfo:function(){
	 		console.log(this);
	 		var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			
			var client_id = this.leads_id;
			var MongoClient = require('mongodb').MongoClient;
			MongoClient.connect('mongodb://'+mongoCredentials.host+":"+mongoCredentials.port+"/prod", function(err, db){
				var client_settings_collection = db.collection("client_settings");
				var filter = {client_id:parseInt(client_id)};
				client_settings_collection.find(filter).toArray(function(err, client_basic_info){
					if (err){
						willFulfillDeferred.reject(err);
					}
					//console.log(client_basic_info);
					client_basic_info = client_basic_info[0];
					delete client_basic_info.full_content;
					var basic_info = {
						fname : client_basic_info.client_doc.client_fname,
						lname : client_basic_info.client_doc.client_lname,
						email : client_basic_info.client_doc.client_email,
						company_name : client_basic_info.lead.company_name,
						company_address : client_basic_info.lead.company_address,
						officenumber : client_basic_info.lead.officenumber,
						mobile : client_basic_info.lead.mobile,
						supervisor_email : client_basic_info.lead.supervisor_email,
						acct_dept_email1 : client_basic_info.lead.acct_dept_email1,
						acct_dept_email2 : client_basic_info.lead.acct_dept_email2,
						sec_email : client_basic_info.lead.sec_email,
						days_before_suspension : client_basic_info.client_doc.days_before_suspension,
					};
					console.log(basic_info);
					me.client_basic_info = basic_info;
					db.close();
					willFulfillDeferred.resolve(basic_info);
		
				});
			});
		
		
			return willFulfill;
	 	}
	 	
	 	
	 }

});




Subcontractors.belongsTo(leadInfoSchema, {foreignKey: "leads_id"});
Subcontractors.belongsTo(personalInfoSchema, {foreignKey: "userid", targetKey: "userid"});



//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = Subcontractors;
