var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../../config/configs");
var numWorkers = 4;
var invoices_queue = Queue('xero_invoices_queue', 6379, '127.0.0.1');

var invoicesProcessDef = require("./invoice");

invoices_queue.process(invoicesProcessDef.processPerInvoice);

module.exports = invoices_queue;