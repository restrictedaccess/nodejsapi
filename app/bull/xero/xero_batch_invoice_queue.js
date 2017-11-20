var Queue = require('bull');
var cluster = require("cluster");
var configs = require("../../config/configs");
var numWorkers = 4;
var invoice_queue = Queue('xero_batch_invoices_queue', 6379, '127.0.0.1');

var invoiceDef = require("./invoice");

invoice_queue.process(invoiceDef.processBatchInvoices);

module.exports = invoice_queue;