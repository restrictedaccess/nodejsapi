var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var configs = require("../config/configs");
var Q = require('q');
var http = require('http');

var env = require("../config/env");
var mongoCredentials = configs.getMongoCredentials();

// much more concise declaration
function GridFs() {

}


/**
 * Returns true if the same false otherwise
 * @param file_path
 * @param md5_to_compare
 * @returns {*}
 */
GridFs.prototype.getIfMd5Different = function(file_path, md5_to_compare){

    var md5File = require('md5-file');

    var fetchMd5Deferred = Q.defer();
    var willFulfill = fetchMd5Deferred.promise;
    var me = this;

    try{
        /* Async usage */
        md5File(file_path, function(err, hash){
            if (err) {
                console.log("MD5 Error" + file_path);
                console.log("MD5_to_compare " + md5_to_compare);
                console.log(err);
                fetchMd5Deferred.resolve(true);
            }

            console.log('The MD5 sum of file is: ' + hash);
            if(hash != "" && hash != null){
                if(md5_to_compare == hash){
                    fetchMd5Deferred.resolve(false);
                } else{
                    fetchMd5Deferred.resolve(true);
                }
            } else{
                fetchMd5Deferred.resolve(true);
            }

        });
    } catch(error){
        console.log("MD5 Error" + file_path);
        console.log("MD5_to_compare " + md5_to_compare);
        console.log(error);
        fetchMd5Deferred.resolve(true);
    }


    return willFulfill;
};

/**
 * Fetches the metadata of a gridfs file given a search key
 * @param search_key
 * @returns {*}
 */
GridFs.prototype.getFileMetaData = function(search_key){
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;

    db.once('open', function () {
        var gfs = Grid(db.db);
        gfs.findOne(search_key, function (err, file) {
            db.close();
            if(err){
                console.log(err);
                willFulfillDeferred.resolve(null);
            }
            willFulfillDeferred.resolve(file);
        });

    });


    return willFulfill;

};

/**
 * saves file to grid fs (insert if not existing, update otherwise)
 *
 * NOTE: Only works with multer middleware
 *
 * @param file
 * @param filename
 * @returns {*}
 */
GridFs.prototype.saveFile = function(file, filename){
    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;

    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;

    db.once('open', function () {
        var gfs = Grid(db.db);

        gfs.exist({
            filename: filename
        }, function (err, found) {
            if (err) {
                console.log("error checking filename exists " + filename);
                console.error(err);
                db.close();
                willFulfillDeferred.reject(err);
            }

            var searchExistsDeferred = Q.defer();
            var searchExistsPromise = searchExistsDeferred.promise;
            if(found){
                console.log("found existing => " + filename);
                gfs.remove({
                    filename: filename
                }, function (err) {
                    if (err) {
                        console.log("error removing filename in gridfs " + filename);
                        console.error(err);
                        db.close();
                        willFulfillDeferred.reject(err);
                        searchExistsDeferred.reject(err);
                    }
                    searchExistsDeferred.resolve({success:true});
                    console.log('successfully removed ' + filename);
                });
            } else{

                console.log('NOT FOUND ' + filename);
                searchExistsDeferred.resolve({success:true});
            }

            searchExistsPromise.then(function(searchResult){
                // streaming to gridfs
                //filename to store in mongodb
                var writestream = gfs.createWriteStream({
                    filename: filename,
                    content_type: file.mimetype
                });
                fs.createReadStream(file.path).pipe(writestream);

                writestream.on('close', function (file) {
                    // do something with `file`
                    console.log(file.filename + ' Written To DB');
                    db.close();

                    willFulfillDeferred.resolve(file);
                });
            });

        });


    });

    return willFulfill;

};


/**
 * Removes file from grid fs
 * @param filename
 * @returns {*}
 */
GridFs.prototype.removeFile = function(filename){

    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;


    var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/prod", mongoCredentials.options);

    var fs = require('fs');
    var Grid = require('gridfs-stream');
    Grid.mongo = mongoose.mongo;



    db.once('open', function () {
        var gfs = Grid(db.db);

        gfs.exist({
            filename: filename
        }, function (err, found) {
            if (err) {
                console.log("error checking filename exists " + filename);
                console.error(err);
                db.close();
                willFulfillDeferred.reject(err);
            }

            if(found){
                console.log("found existing => " + filename);
                gfs.remove({
                    filename: filename
                }, function (err) {
                    if (err) {
                        console.log("error removing filename in gridfs " + filename);
                        console.error(err);
                        db.close();
                        willFulfillDeferred.reject(err);
                    }
                    willFulfillDeferred.resolve({success:true});
                    console.log('successfully removed ' + filename);
                });
            } else{
                willFulfillDeferred.reject({success:false, error: "No such file!"});
            }
        });
    });


    return willFulfill;
};


/**
 * Returns the meta data given a remote path to a file
 * @param remote_path
 * @param tmp_path
 * @returns {
     *          success: true,
                data: data,
                ext: mimteType.ext,
                mimetype: mimteType.mime,
                path: tmp_path
            }
 */
GridFs.prototype.getFileFromRemoteHost = function(remote_path, tmp_path){
    var fs = require('fs');
    var fileType = require('file-type');
    


    var willFulfillDeferred = Q.defer();
    var willFulfill = willFulfillDeferred.promise;
    var me = this;

    var file = fs.createWriteStream(tmp_path);

    if (env.environment=="production"){
        http = require('https');
    }
    console.log("remote Path");
    console.log(remote_path);

    file.on('open', function(fd) {

        http.get(remote_path, function(response) {
            var data = "";
            response.on('data', function (chunk) {
                file.write(chunk);

            }).on('end', function(){
                var mimteType = fileType(data);
                if(mimteType){
                    var result = {
                        success: true,
                        data: data,
                        ext: mimteType.ext,
                        mimetype: mimteType.mime,
                        path: tmp_path
                    };

                    willFulfillDeferred.resolve(result);
                } else{
                    console.log("try to get the extension from the end of the remote path" + remote_path);
                    var mime = require('mime-types');
                    var mimeLookedUp = mime.lookup(remote_path);var type = mime.lookup(remote_path);

                    if(mimeLookedUp){

                        var extLookedUp = mime.extension(type);

                        console.log("MimeLookedUp: " + mimeLookedUp);


                        var result = {
                            success: true,
                            data: data,
                            ext: extLookedUp,
                            mimetype: mimeLookedUp,
                            path: tmp_path
                        };

                        willFulfillDeferred.resolve(result);
                    } else{
                        console.log("Failed to et the extension from the end of the remote path" + remote_path);
                        willFulfillDeferred.resolve(false);
                    }

                }

                file.end(function() {
                    console.log("file written! " + remote_path);
                });
            });
        });
    });

    return willFulfill;
};




// no need to overwrite `exports` ... since you're replacing `module.exports` itself
module.exports = GridFs;