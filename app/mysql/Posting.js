/**
 * Created by joenefloresca on 03/03/2017.
 */
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var leadSchema = require("../mysql/Lead_Info");

var sequelize = require("../mysql/sequelize");


var postingSchema = sequelize.define('posting',{

    jobposition: {type: Sequelize.STRING},
    lead_id: {type: Sequelize.INTEGER},

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getLeadsInfo:function (userid) {

            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            postingSchema.findAll({
                include: [{model: leadSchema, required: true, attributes:["fname", "lname"]}],
                where:
                    {
                        userid:userid
                    },
                order: "date_listed DESC"
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;
        }

    }
});


postingSchema.belongsTo(leadSchema, {foreignKey: "lead_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = postingSchema;