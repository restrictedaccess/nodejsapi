var Sequelize = require('sequelize');
var configs = require("../config/configs");

var mysqlCredentials = configs.getMysqlCredentials();

if(typeof global.sequelize == "undefined"){
    global.sequelize = new Sequelize(mysqlCredentials.database,mysqlCredentials.user,mysqlCredentials.password,
        {
            host:mysqlCredentials.host,
            dialect: 'mysql',
            pool: {
                max: 500,
                min: 20,
                idle: 20000,
                maxConnections: 20,
                maxIdleTime: 60000
            }
        });
    console.log("single sequelize initialized");
}

module.exports = global.sequelize;


