var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../config/configs");
var numWorkers = 4;
var multiple_candidates_queue = Queue('multiple_candidates_queue', 6379, '127.0.0.1');
var mongoCredentials = configs.getMongoCredentials();


var multipleCandidatesProcessDef = require("../bull/multiple_candidates");

multiple_candidates_queue.process(multipleCandidatesProcessDef.processMultipleCandidatesByDateCluster);

module.exports = multiple_candidates_queue;