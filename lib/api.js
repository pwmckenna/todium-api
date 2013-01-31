/*
 * benc2json
 * https://github.com/pwmckenna/benc2json
 *
 * Copyright (c) 2013 Patrick Williams
 * Licensed under the MIT license.
 */

var headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type'
};

var Firebase = require('./firebase-node');

var port = process.env.PORT || 5000;
http.createServer(function(req, res) {
    var query = URL.parse(req.url, true).query;
    console.log(query);

    // if we don't have a url argument, then lets bail
    if(!query.hasOwnProperty('info_hash') || 
        !query.hasOwnProperty('id') || 
        !query.hasOwnProperty('provider') || 
        !query.hasOwnProperty('token') || 
        !query.hasOwnProperty('src')
    ) {
        res.writeHead(400);
        res.end();
        return;
    }

    var info_hash = query['info_hash'];
    var id = query['id'];
    var provider = query['provider'];
    var token = query['token'];
    var src = query['src'];

    var firebase;
    var onComplete = function(error) {
        console.log('onComplete', error);
        
        var globalTracker = firebase.child('users').child(provider).child(id).child('trackers').push();
        var userTracker = firebase.child('trackers').push();
        userTracker.set({
            owner: id,
            info_hash: info_hash,
            completed: 0,
            transferred: 0,
            src: src,
            labels: [],
            time: new Date().getTime()
        });
        globalTracker.set(userTracker.name());

        var result = src;

        res.writeHead(200, headers);
        if(query.hasOwnProperty('callback')) {
            var callback = query['callback'];
            res.end(callback + '("' + result + '")');
        } else {
            res.end('"' + result + '"');
        }
    };

    var onCancel = function(error) {
        console.log('onCancel', error);
    }

    firebase = new Firebase('https://featuredcontent.firebaseio.com/', onComplete, onCancel);
    firebase.auth(token);
}).listen(port, function() {
    console.log('Listening on ' + port);
});