/**
 * Created by joenefloresca on 04/03/2017.
 */
/**
 * Created by joenefloresca on 04/03/2017.
 */
var Sequelize = require('sequelize');
var configs = require("../config/configs");
var Q = require('q');
var mysqlCredentials = configs.getMysqlCredentials();

var adminSchema = require("../mysql/Admin_Info");

var sequelize = require("../mysql/sequelize");
var appAppointmentSchema = sequelize.define('tb_app_appointment',{

    id: {type:Sequelize.INTEGER,primaryKey:true, autoIncrement: true},
    user_id: {type: Sequelize.INTEGER},
    leads_id:{type: Sequelize.INTEGER}

},{
    freezeTableName : true,
    timestamps: false,
    classMethods:{
        getAppAppointmentData:function(id){


            var willFulfillDeferred = Q.defer();
            var willFulfill = willFulfillDeferred.promise;

            appAppointmentSchema.findAll({
                include: [{model: adminSchema, required: true, attributes:["admin_fname", "admin_lname"]}],
                where:{
                    id:id
                },
            }).then(function(foundObject){

                willFulfillDeferred.resolve(foundObject);
            });

            return willFulfill;

        },

    }
});

appAppointmentSchema.belongsTo(adminSchema, {foreignKey: "user_id", targetKey: "admin_id"});


//Only call this function sequelize.sync(); if table does not exists
//IMPORTANT:

//COMMENT OUT OR REMOVE after deployment
//May cause system failure for mysql
// sequelize.sync();
module.exports = appAppointmentSchema;
