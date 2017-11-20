var Queue = require('bull');
var timeRecordsQueue = Queue("rssc_time_records", 6379, '127.0.0.1');

timeRecordsQueue.process(function(job, done){
    console.log("Hey!!!");
});

module.exports = timeRecordsQueue;