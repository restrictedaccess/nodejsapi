var Sequelize = require('sequelize');
var configs = require("../config/configs");
var leadsInfoSchema = require("../mysql/Lead_Info");
var quoteComponent = require("../components/Quote");
var quoteDetailSchema = require("../mysql/Quote_Details");
var SAschema = require("../mysql/ServiceAgreement");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();
var sequelize = require("../mysql/sequelize");


var quoteSchema = sequelize.define('quote',{

	id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
	leads_id: {type:Sequelize.INTEGER},
	created_by: {type:Sequelize.INTEGER},
	created_by_type: {type:Sequelize.STRING},
	status: {type:Sequelize.STRING},
	quote_no: {type:Sequelize.INTEGER},
	date_quoted: {type:Sequelize.DATE},
	date_posted: {type:Sequelize.DATE},
	ran: {type: Sequelize.STRING}
},{
	freezeTableName : true,
	timestamps: false,
	classMethods:
	{
		getLeadsID:function(id,leads_id){
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(id){

				quoteSchema.findOne({

					attributes:[

						'leads_id','created_by','created_by_type',
						'status','date_quoted','date_posted','ran'
					],

					where:{
						id : id
					}

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});


			}
			else if(leads_id)
			{
				quoteSchema.findAll({

					attributes:[

						'leads_id','created_by','created_by_type',
						'status','date_quoted','date_posted','ran'
					],

					where:{
						leads_id : leads_id
					}

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});
			}

			else{


				var sql = "SELECT (q.id) as quote_id,q.date_quoted,(l.id) as leads_id,CONCAT(l.fname,' ',l.lname) as fullname,l.email ,l.status,SUM(IF(q.status = 'new', 1,0)) AS 'new_count',"+
					"SUM(IF(q.status = 'posted', 1,0)) AS 'posted_count',"+
					"SUM(IF(q.status = 'draft', 1,0)) AS 'draft_count',"
					+"SUM(IF(q.status = 'deleted', 1,0)) AS 'deleted_count',"
					+"SUM(IF(sa.accepted = 'no', 1,0)) AS 'sa_count_pending' ,"
					+"SUM(IF(sa.accepted = 'yes', 1,0)) AS 'sa_count_accepted' "
					+"FROM leads l "
					+"LEFT JOIN quote q ON q.leads_id = l.id "
					+"LEFT JOIN service_agreement sa ON sa.quote_id = q.id "
					+"WHERE l.status NOT IN ('inactive' , 'REMOVED') "
					+"GROUP BY l.id ORDER by l.id DESC";


				var sql1 = "SELECT * FROM leads";



				sequelize.query(sql
					, { type: sequelize.QueryTypes.SELECT}).then(function(users) {

					if(users)
					{
						willFulfillDeferred.resolve(users);
					}
					users = null;

				});

			}

			return willFulfill;

		},

		searchLead:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(!params.filter)
			{
				var sql="SELECT (q.id) as quote_id,q.date_quoted,(l.id) as leads_id,l.fname,l.lname,CONCAT(l.fname,' ',l.lname) as fullname,l.email ,l.status,SUM(IF(q.status = 'new', 1,0)) AS 'new_count',"+
					"SUM(IF(q.status = 'posted', 1,0)) AS 'posted_count',"+
					"SUM(IF(q.status = 'draft', 1,0)) AS 'draft_count',"
					+"SUM(IF(q.status = 'deleted', 1,0)) AS 'deleted_count',"
					// +"SUM(IF(q.status = 'accepted', 1,0)) AS 'accepted_count',"
					+"SUM(IF(sa.accepted = 'no', 1,0)) AS 'sa_count_pending' ,"
					+"SUM(IF(sa.accepted = 'yes', 1,0)) AS 'sa_count_accepted' "
					+"FROM leads l "
					+"LEFT JOIN quote q ON q.leads_id = l.id "
					+"LEFT JOIN service_agreement sa ON sa.quote_id = q.id "
					+"WHERE l.status NOT IN ('inactive' , 'REMOVED') "
					+"AND q.date_quoted BETWEEN '"+params.startDate+"' AND '"+params.endDate+"' "
					+"GROUP BY l.id ORDER by q.id DESC";

			}
			else
			{

				if(params.startDate && params.endDate)
				{
					var sql="SELECT (q.id) as quote_id,q.date_quoted,(l.id) as leads_id,l.fname,l.lname,CONCAT(l.fname,' ',l.lname) as fullname,l.email ,l.status,SUM(IF(q.status = 'new', 1,0)) AS 'new_count',"+
						"SUM(IF(q.status = 'posted', 1,0)) AS 'posted_count',"+
						"SUM(IF(q.status = 'draft', 1,0)) AS 'draft_count',"
						// +"SUM(IF(q.status = 'accepted', 1,0)) AS 'accepted_count',"
						+"SUM(IF(sa.accepted = 'no', 1,0)) AS 'sa_count_pending' ,"
						+"SUM(IF(sa.accepted = 'yes', 1,0)) AS 'sa_count_accepted' "
						+"FROM leads l "
						+"LEFT JOIN quote q ON q.leads_id = l.id "
						+"LEFT JOIN service_agreement sa ON sa.quote_id = q.id "
						+"WHERE l.status NOT IN ('inactive' , 'REMOVED') "
						+"AND q.date_quoted BETWEEN '"+params.startDate+"' AND '"+params.endDate+"' "
						+"AND CONCAT_WS('',q.id, l.id, l.fname,l.lname,CONCAT(l.fname,' ',l.lname),l.email,l.status) LIKE '%"+params.filter+"%' "
						+"GROUP BY l.id ORDER by q.id DESC";
				}
				else
				{
					var sql="SELECT (q.id) as quote_id,q.date_quoted,(l.id) as leads_id,l.fname,l.lname,CONCAT(l.fname,' ',l.lname) as fullname,l.email ,l.status,SUM(IF(q.status = 'new', 1,0)) AS 'new_count',"+
						"SUM(IF(q.status = 'posted', 1,0)) AS 'posted_count',"+
						"SUM(IF(q.status = 'draft', 1,0)) AS 'draft_count',"
						// +"SUM(IF(q.status = 'accepted', 1,0)) AS 'accepted_count',"
						+"SUM(IF(sa.accepted = 'no', 1,0)) AS 'sa_count_pending' ,"
						+"SUM(IF(sa.accepted = 'yes', 1,0)) AS 'sa_count_accepted' "
						+"FROM leads l "
						+"LEFT JOIN quote q ON q.leads_id = l.id "
						+"LEFT JOIN service_agreement sa ON sa.quote_id = q.id "
						+"WHERE l.status NOT IN ('inactive' , 'REMOVED') "
						+"AND l.id="+params.filter+" "
						+"GROUP BY l.id ORDER by q.id DESC";
				}


			}

			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

				willFulfillDeferred.resolve(searchData);
			});

			return willFulfill;
//


		},

		getQuotebyLead:function(params){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			var status="";
			if(params.status){status=params.status;}

			if(params.status == "no" || params.status == "yes" )
			{


				var sql = "SELECT * FROM quote q LEFT JOIN service_agreement sa on sa.quote_id = q.id "
					+"WHERE q.leads_id ="+params.leads_id+" AND sa.accepted='"+params.status+"' ORDER BY sa.service_agreement_id DESC";


				sequelize.query(sql
					, { type: sequelize.QueryTypes.SELECT}).then(function(searchData) {

					willFulfillDeferred.resolve(searchData);
				});

				return willFulfill;

			}


			quoteSchema.findAll({
				where:{
					leads_id : params.leads_id,
					status:status
				},
				order: [
					['id', 'DESC']
				]
			}).then(function(foundObject){

				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;
		},

		getTotalQuote:function(leads_id){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(leads_id)
			{
				quoteSchema.findAndCountAll({
					where:{
						leads_id : leads_id
					}

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});
			}
			else {
				quoteSchema.findAndCountAll({

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});
			}


			return willFulfill;
		},

		insertQuote:function(params){

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			quoteSchema.create({

				created_by: params.created_by,
				created_by_type: params.created_by_type,
				leads_id: params.leads_id,
				date_quoted: new Date(),
				ran: params.ran,
				status: "draft"

			}).then(function(data){

				if(data){

					data.updateAttributes({

						quote_no: data.id

					}).then(function(result){

						result.id = data.id;
						willFulfillDeferred.resolve(result);

					});

				}
			});

			return willFulfill;
		},

		updateQuote:function(params){


			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(!params.status)
			{
				quoteSchema.update({

					status: "new"
				},{

					where:{
						id: params.quote_id,
						status:"draft"
					}

				}).then(function(updatedData){
					willFulfillDeferred.resolve(updatedData);
				});

			}
			else {


				if(params.status == "posted")
				{

					quoteSchema.update({

						status: params.status,
						date_posted:new Date()

					},{

						where:{
							id: params.quote_id
						}

					}).then(function(updatedData){


						willFulfillDeferred.resolve(updatedData);
					});


				}else
				{
					quoteSchema.update({

						status: params.status
					},{

						where:{
							id: params.quote_id
						}

					}).then(function(updatedData){


						willFulfillDeferred.resolve(updatedData);
					});
				}



			}

			return willFulfill;
		},
		acceptQuote:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			quoteSchema.update({

				status: "accepted"
			},{

				where:{
					id: params
				}

			}).then(function(updatedData){
				willFulfillDeferred.resolve(updatedData);
			});

			return willFulfill;

		},
		getStaffSalary:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(params.partTime)
			{
				sql = "SELECT p.code FROM products p INNER JOIN staff_rate s ON s.part_time_product_id = p.id WHERE s.userid ="+params.userid;
			}
			else
			{
				sql = "SELECT p.code FROM products p INNER JOIN staff_rate s ON s.product_id = p.id WHERE s.userid ="+params.userid;
			}


			sequelize.query(sql
				, { type: sequelize.QueryTypes.SELECT}).then(function(price) {

				willFulfillDeferred.resolve(price);
			});

			return willFulfill;
		},
		dataForSync:function(offset)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			quoteSchema.findOne({


				limit:1,
				offset:offset

			}).then(function(foundObject){


				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;
		},

		getQuoteID:function(ran)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			quoteSchema.findOne({

				attributes:['id'],
				where:{
					ran:ran
				}

			}).then(function(foundObject){


				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;

		},

		getQuoteByLeads:function(leads_id)
		{

			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			quoteSchema.findAll({

				attributes:[

					'id','created_by','created_by_type',
					'status','date_quoted','date_posted','ran'
				],

				where:{
					leads_id : leads_id
				}

			}).then(function(foundObject){

				willFulfillDeferred.resolve(foundObject);
			});

			return willFulfill;
		},

		getQuoteData:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			if(params.id)
			{
				quoteSchema.findOne({

					attributes:[

						'id','created_by','created_by_type',
						'status','date_quoted','date_posted','ran'
					],
					where:{
						id:{$eq:params.id,$notIn:[sequelize.literal('SELECT quote_id FROM quote_sync_mongo')]}
					}
				}).then(function(foundObject){
					willFulfillDeferred.resolve(foundObject);
				});
			}
			else
			{
				quoteSchema.findAll({
					attributes:[

						'id','created_by','created_by_type',
						'status','date_quoted','date_posted','ran'
					],
					offset:((params.page-1)*params.limit),
					limit : params.limit,
					where:{
						id:{$notIn:[sequelize.literal('SELECT quote_id FROM quote_sync_mongo')]}
					},
					order: [
						['id', 'DESC']
					]
				}).then(function(foundObject){
					willFulfillDeferred.resolve(foundObject);
				});
			}
			return willFulfill;
		},
		countTotalQuote:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			if(params.id)
			{

				quoteSchema.count({

					where:{
						id:{$eq:params.id,$notIn:[sequelize.literal('SELECT quote_id FROM quote_sync_mongo')]}
					}

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});
			}
			else
			{
				quoteSchema.count({
					where:{
						id:{$notIn:[sequelize.literal('SELECT quote_id FROM quote_sync_mongo')]}
					}
				}).then(function(foundObject){
					willFulfillDeferred.resolve(foundObject);
				});
			}
			return willFulfill;

		},
		insertSyncMongo:function(params)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			sql="INSERT INTO quote_sync_mongo(date_synced,quote_id)VALUES(NOW(),"+params+")";

			sequelize.query(sql
				, { type: sequelize.QueryTypes.INSERT}).then(function(data) {

				willFulfillDeferred.resolve(data);
			});

			return willFulfill;
		},
		deleteSync:function(id)
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;

			sql="DELETE FROM quote_sync_mongo WHERE quote_id="+id;

			sequelize.query(sql
				,{ type: sequelize.QueryTypes.DELETE}).then(function(data) {
				willFulfillDeferred.resolve(data);
			});
			return willFulfill;

		}
	},
	instanceMethods:
	{
		getDetails:function()
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			var me = this;

			try {

				quoteDetailSchema.getQuoteDetails(this.id).then(function(details){

					me.quote_details = details;
					willFulfillDeferred.resolve(details);
				});


			}catch(e)
			{
				console.log("details null");
				willFulfillDeferred.resolve(false);
			}
			return willFulfill;
		},

		getSA:function()
		{
			var willFulfillDeferred = Q.defer();
			var willFulfill = willFulfillDeferred.promise;
			var me = this;

			try {
				SAschema.getServiceAgreement(this.id).then(function(service_agreement){

					me.sa = service_agreement;
					willFulfillDeferred.resolve(service_agreement);
				});
			}
			catch(e)
			{
				console.log("sa null");
				willFulfillDeferred.resolve(false);
			}

			return willFulfill;
		},
		structureQuoteData:function()
		{
			var temp = {};
			var quote = this;
			var quote_details = this.quote_details;
			var service_agreement = this.sa;

			temp.quote = quote;
			temp.details = quote_details;
			temp.sa = service_agreement;


			return temp;
		}
	}

});



//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = quoteSchema;
