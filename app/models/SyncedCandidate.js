var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var console = require('console');
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();

var syncedCandidateSchema = new Schema({
    candidate_id:Number,
}, {
    collection:"synced_candidates"
});


module.exports = syncedCandidateSchema;