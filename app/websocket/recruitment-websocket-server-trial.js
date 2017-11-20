var Q = require('q');

var configs = require("../config/configs");
var console = require('console');
var mongoose = require('mongoose');
var express = require('express');
var app = express();
var http = require('http');
var url = require('url');
var WebSocket = require('ws');

var mongoCredentials = configs.getMongoCredentials();
var websocketSchema = require("../models/Websocket");


function createWebsocketServer(port){
    //websocket
    var server = http.createServer(app);
    var wss = new WebSocket.Server({ server });


    wss.on('connection', function connection(ws, req) {
        var location = url.parse(req.url, true);
        console.log((new Date()) + ' Received request for ' + req.url);
        // You might use location.query.access_token to authenticate or share sessions
        // or req.headers.cookie (see http://stackoverflow.com/a/163 95220/151312)
        if(typeof location.query.hash != "undefined"){
            ws.unique_hash = location.query.hash;
        } else{
            console.log("Hash is required!");
            ws.close();
        }


        var db = mongoose.createConnection("mongodb://"+mongoCredentials.host+":"+mongoCredentials.port+"/websocket");

        var WebsocketModel = db.model("Websocket", websocketSchema);
        var WebsocketObj = new WebsocketModel();

        db.once("open", function(){
            db.close();
        });


        ws.on('message', function incoming(message) {
            // console.log('received sadfasdfasdf: %s', message);
            var message_valid = true;

            try{
                var parseMessage = JSON.parse(message);
                console.log(parseMessage);
            } catch(message_error){
                message_valid = false;
                console.log(message_error);
            }


            if(message_valid){

                console.log("connected clients: " + wss.clients.size);

                // Broadcast to everyone else.
                wss.clients.forEach(function each(client) {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {

                        if(typeof parseMessage.hash == "undefined"){
                            console.log("Broadcast to all clients");
                            client.send(message);

                            try{

                                WebsocketObj.saveData({
                                    data_sent: parseMessage,
                                    date_sent: configs.getDateToday()
                                });
                            } catch(major_error){
                                console.log(major_error);
                            }
                        } else if(parseMessage.hash == client.unique_hash){
                            console.log("Send to specific client: " + client.unique_hash);
                            client.send(message);
                            try{

                                WebsocketObj.saveData({
                                    data_sent: parseMessage,
                                    date_sent: configs.getDateToday()
                                });
                            } catch(major_error){
                                console.log(major_error);
                            }
                        }

                    }
                });
            }

        });

    });



    server.listen(port, function listening() {
        console.log('Listening on %d', server.address().port);
    });


}
//
// //system-wide
// createWebsocketServer(6023);
//
// //accounts
// createWebsocketServer(6024);
//
// //compliance
// createWebsocketServer(6025);

//recruitment
createWebsocketServer(6026);