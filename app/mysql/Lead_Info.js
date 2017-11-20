var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var mongoCredentials = configs.getMongoCredentials();

var quoteSchema = require("../mysql/Quote");
var Admin_Info = require("../mysql/Admin_Info");
var quoteMongoSchema = require("../models/QuoteModel");
var quoteComponent = require("../components/Quote");

var sequelize = require("../mysql/sequelize");

var adminInfoSchema = require("../mysql/Admin_Info");

var leadInfoSchema = sequelize.define('leads',{

		id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
		fname: {type: Sequelize.STRING},
		lname: {type: Sequelize.STRING},
		email: {type: Sequelize.STRING},
		hiring_coordinator_id: {type: Sequelize.INTEGER},
		last_updated_date: {type: Sequelize.DATE},
		company_name: {type: Sequelize.STRING},
		company_address: {type: Sequelize.STRING},
		mobile: {type: Sequelize.STRING},
		officenumber: {type: Sequelize.STRING},
		status: {type: Sequelize.STRING},
		csro_id: {type: Sequelize.STRING},
		business_partner_id: {type: Sequelize.STRING},
		abn_number: {type: Sequelize.STRING},



	},
	{

		freezeTableName : true,
		timestamps: false,
		classMethods:
		{
			fetchSingleClientsInfoWithAttributes:function(where, attributes){

				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				leadInfoSchema.findOne({
					attributes:attributes,
					where:where
				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});


				return willFulfill;
			},
			getTotalActiveStaff:function(client_id){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				var sql = "SELECT COUNT(id)AS total_active FROM subcontractors WHERE status IN('ACTIVE', 'suspended') AND leads_id="+client_id;
				sequelize.query(sql , { type: sequelize.QueryTypes.SELECT}).then(function(result) {
					if(result)
					{
						willFulfillDeferred.resolve(result);
					}
				});

				return willFulfill;
			},

			getClientInfo:function(client_id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				var sql = "SELECT * FROM leads WHERE id="+client_id;
				sequelize.query(sql , { type: sequelize.QueryTypes.SELECT}).then(function(client) {
					if(client)
					{
						willFulfillDeferred.resolve(client);
					}
				});

				return willFulfill;
			},

			getLeadsInfo:function($leads_id){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				if($leads_id)
				{
					leadInfoSchema.find({
						attributes:
							['fname','lname','email','mobile','company_address','company_name','status','hiring_coordinator_id'],
						where:
						{
							id:$leads_id
						}
					}).then(function(foundObject){

						willFulfillDeferred.resolve(foundObject);
					});
				}
				else
				{

					leadInfoSchema.findAll({
						attributes:
							['id','fname','lname','email','mobile','company_address','company_name','status'],
						where:
						{
							status:{$notIn:['inactive' , 'REMOVED']}
						},
						order:
							[
								['id', 'DESC']
							]

					}).then(function(result){



						willFulfillDeferred.resolve(result);
					});

				}



				return willFulfill;

			},
			updateLeads:function(params){
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				leadInfoSchema.update({
					last_updated_date: new Date()


				},{
					where:{
						id:params
					}
				}).then(function(data){

					willFulfillDeferred.resolve(data);
				});
				return willFulfill;

			},
			countAllLeads:function(params)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				leadInfoSchema.findAndCountAll({
					attributes:
						['id','fname','lname','email','mobile','company_address','company_name','status'],
					where:
					{
						status:{$notIn:['inactive' , 'REMOVED']}
					},
					order:
						[
							['id', 'DESC']
						]

				}).then(function(result){

					willFulfillDeferred.resolve(result);
				});

				return willFulfill;
			},
			countData:function(leads_id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				var where = {status:{$notIn:['inactive' , 'REMOVED']}};

				if(leads_id)
				{
					where  = {id:leads_id,status:{$notIn:['inactive' , 'REMOVED']}}
				}

				leadInfoSchema.count({

					where:where

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});

				return willFulfill;
			},
			countSolr:function(leads_id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				var where = {status:{$notIn:['inactive' , 'REMOVED']}};

				if(leads_id)
				{
					where = {
						id:{$eq:leads_id,$notIn:[sequelize.literal('SELECT leads_id FROM quote_solr_sync')]},
						status:{$notIn:['inactive' , 'REMOVED']}
					}
				}
				else
				{
					where = {
						id:{$notIn:[sequelize.literal('SELECT leads_id FROM quote_solr_sync')]},
						status:{$notIn:['inactive' , 'REMOVED']}
					}
				}

				leadInfoSchema.count({

					where:where

				}).then(function(foundObject){

					willFulfillDeferred.resolve(foundObject);
				});

				return willFulfill;
			},

			getOffsetLeadsData:function(params)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				if(params.leads_id)
				{
					leadInfoSchema.find({
						attributes:
							['id','fname','lname','email','mobile','company_address','company_name','status','hiring_coordinator_id'],
						where:
						{
							id:params.leads_id,
							status:{$notIn:['inactive' , 'REMOVED']}
						}
					}).then(function(foundObject){

						willFulfillDeferred.resolve(foundObject);
					});
				}
				else
				{
					leadInfoSchema.findAll({
						attributes:
							['id','fname','lname','email','mobile','company_address','company_name','status'],
						offset:((params.page-1)*params.limit),
						limit : params.limit,
						where:
						{
							status:{$notIn:['inactive' , 'REMOVED']}
						},
						order:
							[
								['id', 'DESC']
							]

					}).then(function(result){

						willFulfillDeferred.resolve(result);
					});
				}

				return willFulfill;

			},
			idForSolrSync:function(params)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				if(params.leads_id)
				{
					leadInfoSchema.find({
						attributes:
							['id','fname','lname','email','mobile','company_address','company_name','status','hiring_coordinator_id'],
						where:
						{
							id:{$eq:params.leads_id,$notIn:[sequelize.literal('SELECT leads_id FROM quote_solr_sync')]},
							status:{$notIn:['inactive' , 'REMOVED']}
						}
					}).then(function(foundObject){

						willFulfillDeferred.resolve(foundObject);
					});
				}
				else
				{
					leadInfoSchema.findAll({
						attributes:
							['id','fname','lname','email','mobile','company_address','company_name','status'],
						offset:((params.page-1)*params.limit),
						limit : params.limit,
						where:
						{
							id:{$notIn:[sequelize.literal('SELECT leads_id FROM quote_solr_sync')]},
							status:{$notIn:['inactive' , 'REMOVED']}
						},
						order:
							[
								['id', 'DESC']
							]

					}).then(function(result){

						willFulfillDeferred.resolve(result);
					});
				}

				return willFulfill;
			},
			checkSolr:function(id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				sql="SELECT COUNT(*) as count FROM quote_solr_sync WHERE leads_id="+id;

				sequelize.query(sql
					,{ type: sequelize.QueryTypes.SELECT}).then(function(data) {
					willFulfillDeferred.resolve(data[0].count);
				});
				return willFulfill;

			},
			saveSolr:function(id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				sql="INSERT INTO quote_solr_sync(leads_id,date_synced) VALUES("+id+",NOW())";

				sequelize.query(sql
					,{ type: sequelize.QueryTypes.INSERT}).then(function(data) {
					willFulfillDeferred.resolve(data);
				});
				return willFulfill;
			},
			delSolr:function(id)
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				sql="DELETE FROM quote_solr_sync WHERE leads_id="+id;

				sequelize.query(sql
					,{ type: sequelize.QueryTypes.DELETE}).then(function(data) {
					willFulfillDeferred.resolve(data);
				});
				return willFulfill;
			}

		},
		instanceMethods:
		{
			getQuote:function()
			{
				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;
				var me = this;


				var leads = [];
				var promises = [];

				function delay() {
					return Q.delay(100);
				}

				try {
					quoteSchema.getQuoteByLeads(this.id).then(function(quote){

						if(quote)
						{
							for (var i = 0; i < quote.length; i++)
							{
								item = quote[i];

								var per_quote_promises = [];

								var promise_quote_details = item.getDetails();
								var promise_quote_sa = item.getSA();

								per_quote_promises.push(promise_quote_details);
								per_quote_promises.push(delay());

								per_quote_promises.push(promise_quote_sa);
								per_quote_promises.push(delay());

								per_leads_promises_promise = Q.allSettled(per_quote_promises);
								promises.push(per_leads_promises_promise);
								promises.push(delay);
							}

							var allPromise = Q.all(promises);
							allPromise.then(function (results) {
								console.log("Promise Done!");

								for(var i = 0 ; i < quote.length ; i++ )
								{
									leads.push(quote[i].structureQuoteData());
								}


								me.leads_quote = leads;
								willFulfillDeferred.resolve(leads);

								return willFulfill;
							});


						}
						else
						{
							console.log("null quote");
							willFulfillDeferred.resolve(false);
						}

					});
				}
				catch(e)
				{
					console.log(e);
					willFulfillDeferred.resolve(false);
				}
				return willFulfill;
			},

			getQuoteMongo:function()
			{
				this.db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod",mongoCredentials.options);
				var quote = this.db.model('Quote',quoteMongoSchema);

				var willFulfillDeferred = Q.defer();
				var willFulfill = willFulfillDeferred.promise;

				var leads_id = this.id;
				var me = this;


				this.db.once('open', function () {

					var filter = {leads_id:parseInt(leads_id)};

					try {

						quote.find(filter).lean().sort({"quote_id" : -1}).exec(function(err, quote_data){


							var posted = 0,
								draft = 0,
								New = 0,
								deleted = 0,
								sa_accepted = 0,
								sa_pending = 0;


							if(err)
							{
								willFulfillDeferred.reject(err);
								me.db.close();
							}

							if(quote_data && quote_data.length > 0)
							{

								function getCountStatus(i)
								{
									if(i < quote_data.length)
									{
										data = quote_data[i];

										sa =(data.service_agreement.length > 0 ? data.service_agreement[0] : null);

										if(data.status == "posted"){posted = posted + 1;}
										else if(data.status == "draft"){draft = draft + 1;}
										else if(data.status == "new"){New = New + 1;}
										else if(data.status == "deleted"){deleted = deleted + 1;}
										else{}

										if(sa)
										{
											if(sa.accepted == "yes"){sa_accepted = sa_accepted + 1}
											else if(sa.accepted == "no"){sa_pending = sa_pending + 1}

											// sa.acceptedCount = sa_accepted;
											// sa.pendingCount = sa_pending;
										}

										if(!me.sync)
										{
											quoteComponent.whosThis(data.created_by,data.created_by_type).then(function(admin){

												data.created_by = {
														admin_id : (admin.admin_id ? admin.admin_id : admin.agent_no ? admin.agent_no : null),
														admin_fname: (admin.admin_fname ? admin.admin_fname : admin.fname ? admin.fname : ""),
														admin_lname: (admin.admin_lname ? admin.admin_lname : admin.lname ? admin.lname : ""),
														admin_email:(admin.admin_email ? admin.admin_email : admin.email ? admin.email : ""),
														signature_no: (admin.signature_contact_nos ? admin.signature_contact_nos : ""),
														signature_company: (admin.signature_company ? admin.signature_company : "")
													}

												getCountStatus(i+1);
											});
										}
										else
										{
											getCountStatus(i+1);
										}

									}
									else
									{
										me.leads_quote = quote_data;
										me.countData = {
											postedCount : posted,
											draftCount : draft,
											newCount : New,
											deletedCount : deleted,
											acceptedCount : sa_accepted,
											pendingCount : sa_pending
										}
										willFulfillDeferred.resolve(me);
									}

								}
								getCountStatus(0);
							}
							else
							{
								me.leads_quote = [];
								me.countData = {
									postedCount : posted,
									draftCount : draft,
									newCount : New,
									deletedCount : deleted,
									acceptedCount : sa_accepted,
									pendingCount : sa_pending
								}
								willFulfillDeferred.resolve(me);
							}

							me.db.close();

						});
					}
					catch(e)
					{
						console.log(e);
					}
				});


				return willFulfill;
			},
			structLeadsData:function()
			{
				var temp = {};

				var leads = this;
				var quote_data = this.leads_quote;
				var countData = this.countData;

				temp.leads = leads;
				temp.quote_data = quote_data;
				temp.count_data = countData;

				return temp;
			}
		}

	});


leadInfoSchema.belongsTo(Admin_Info, {foreignKey:"hiring_coordinator_id", targetKey: "admin_id"});

//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = leadInfoSchema;