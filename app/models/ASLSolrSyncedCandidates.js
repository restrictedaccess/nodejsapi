var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();


//Shema Fields

var fields ={
    candidate_id: Number,
    date_synced: Date
};
var aslSolrSyncedCandidatesSchema  = new Schema(fields,{
    collection:"asl_solr_synced_candidates"
});


module.exports = aslSolrSyncedCandidatesSchema;