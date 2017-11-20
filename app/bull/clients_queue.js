var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../config/configs");
var numWorkers = 4;
var clients_queue = Queue('clients_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();


var clientsProcessDef = require("../bull/clients");

clients_queue.process(clientsProcessDef.processPerClient);

module.exports = clients_queue;