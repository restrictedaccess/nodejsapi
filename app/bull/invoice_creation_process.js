/**
 * Created by JMOQUENDO on 6/27/17.
 */

var Queue = require('bull');
var invoice_creation_process_queue = Queue("invoice_creation", 6379, '127.0.0.1');
var invoice_creation_queue = require("../bull/invoice_auto-creation");

invoice_creation_process_queue.process(invoice_creation_queue.invoiceCreationQueue);

module.exports = invoice_creation_process_queue;