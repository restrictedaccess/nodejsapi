var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var invoiceSchema = require("../models/Invoice");

var notesSchema  = new Schema({
	client_id:Number,
	admin_id:Number,
	admin : String,
	note : String
}, {
	collection:"client_account_notes"
});


module.exports = notesSchema;