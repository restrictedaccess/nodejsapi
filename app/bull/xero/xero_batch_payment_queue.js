var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../../config/configs");
var numWorkers = 4;
var payments_queue = Queue('xero_batch_payments_queue', 6379, '127.0.0.1');

var invoiceDef = require("./invoice");

payments_queue.process(invoiceDef.processBatchPayments);

module.exports = payments_queue;