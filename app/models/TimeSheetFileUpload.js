var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');

var mongoCredentials = configs.getMongoCredentials();


var schema_fields = {

    timesheet_notes_id:{type:Number},
    length:{type:Number},
    filename:{type:String},
    contentType:{type:String},
    md5:{type:String},
    uploadDate:{type:Date},
    gridfs_id:{type:String}
}

var timesheetDetailsFileUpload = new Schema(schema_fields,
    {collection:"timesheet_file_uploads"});



timesheetDetailsFileUpload.methods.saveFile = function(file, filename, md5, ts){


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
                    me.timesheet_notes_id = ts.id;
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





module.exports = timesheetDetailsFileUpload;