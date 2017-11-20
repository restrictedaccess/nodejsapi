var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();



var schema_fields = {

    userid:{type:Number},
    length:{type:Number},
    filename:{type:String},
    contentType:{type:String},
    md5:{type:String},
    uploadDate:{type:Date},
    gridfs_id:{type:String},
    file_type: [
        "IMAGE",
        "AUDIO",
        "SAMPLE WORK",
        "MOCK CALLS",
        "CHARACTER REFERENCE",
        "RESUME",
        "OTHER",
        "HOME OFFICE PHOTO",
        "INTERNET  SERVICE PROVIDER PHOTO",
        "SIGNED CONTRACT",
        "CREDIT CARD FORM",
        "DIRECT DEBIT FORM",
        "OTHER STAFF FILES",
        "SOFT CONTRACT COPY",
        "ID",
        "BANK FORM",
        "CEDULA",
        "INTERNET BILL",
    ]
}

var candidatesFileUploadsSchema = new Schema(schema_fields,
    {collection:"candidates_file_uploads"});


/**
 *
 * @param file
 * @param filename
 * @param md5
 * @param candidate
 * @param file_type
 * @returns {*}
 */
candidatesFileUploadsSchema.methods.saveFile = function(file, filename, md5, candidate, file_type){


    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;


    var GridFsComponent = require('../components/GridFs');
    var gridFsInstance = new GridFsComponent();


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    db.once('open', function () {

        var fetchMd5Deferred = Q.defer();
        var fetchMd5Promise = fetchMd5Deferred.promise;

        if(me.gridfs_id){

            gridFsInstance.getIfMd5Different(file.path, me.md5).then(function(result){
                fetchMd5Deferred.resolve(result);
            });
        } else{
            fetchMd5Deferred.resolve(true);
        }

        fetchMd5Promise.then(function(md5Different){
            if(md5Different){
                var gridFsSaveResult = gridFsInstance.saveFile(file, filename);

                gridFsSaveResult.then(function(gridFsResult){
                    //save
                    me.userid = candidate.id;
                    me.file_type = file_type;
                    me.filename = gridFsResult.filename;
                    me.contentType = gridFsResult.contentType;
                    me.md5 = gridFsResult.md5;
                    me.uploadDate = gridFsResult.uploadDate;
                    me.gridfs_id = gridFsResult._id;
                    me.length = gridFsResult.length;

                    me.save(function(err, updated_doc){
                        if (err){
                            console.log(err);
                        }
                        db.close();
                        willFulfillDeferred.resolve(updated_doc);
                    });

                });
            } else{

                db.close();
                willFulfillDeferred.resolve({success:false, error: "No changes were made to the file!"});
            }

        });

    });


    return willFulfill;

};


/**
 * Removes file from grid fs
 * @param filename
 * @param candidate
 * @returns {*}
 */
candidatesFileUploadsSchema.methods.removeFile = function(filename, candidate){

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;


    var GridFsComponent = require('../components/GridFs');
    var gridFsInstance = new GridFsComponent();


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);


    db.once('open', function () {
        var gridFsSaveResult = gridFsInstance.removeFile(filename);

        gridFsSaveResult.then(function(gridFsResult){

            willFulfillDeferred.resolve(gridFsResult);

        });
    });



    return willFulfill;
};


module.exports = candidatesFileUploadsSchema;
