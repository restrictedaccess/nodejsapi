var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../config/configs");
var numWorkers = 4;
var candidates_queue = Queue('candidates_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();


var candidatesProcessDef = require("../bull/candidates");

candidates_queue.process(candidatesProcessDef.processPerCandidate);

module.exports = candidates_queue;