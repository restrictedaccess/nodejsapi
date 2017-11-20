function multiProcessQueue(queue, jobs, numberOfWorkers, callback){
    queue.process(callback);
    for(var i=0;i<jobs.length;i++){
        var job = jobs[i];
        queue.add(job)
    }
}
module.exports = multiProcessQueue;