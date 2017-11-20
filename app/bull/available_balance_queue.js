var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../config/configs");
var numWorkers = 4;
var available_balance_queue = Queue('available_balance_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();


var availableBalanceProcessDef = require("../bull/available_balance");

available_balance_queue.process(availableBalanceProcessDef.processPerClient);

module.exports = available_balance_queue;