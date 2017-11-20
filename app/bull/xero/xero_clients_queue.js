var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../../config/configs");
var numWorkers = 4;
var clients_queue = Queue('xero_clients_queue', 6379, '127.0.0.1');

var clientsProcessDef = require("./client");

clients_queue.process(clientsProcessDef.processPerClient);

module.exports = clients_queue;