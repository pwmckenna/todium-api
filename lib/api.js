/*
 * benc2json
 * https://github.com/pwmckenna/benc2json
 *
 * Copyright (c) 2013 Patrick Williams
 * Licensed under the MIT license.
 */

var Firebase = require('./firebase-node');
var http = require('http');
var URL = require('url');
var q = require('q');
var request = require('request');
var URL = require('url');

var headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
    'Access-Control-Allow-Headers': 'Content-Type'
};
var MAGNET_LINK_IDENTIFIER = 'magnet:?xt=urn:btih:';

var addFirebaseTracker = function(firebase, provider, id, info_hash, src, labels) {
    console.log('addFirebaseTracker', provider, id, info_hash, src);

    var userTracker = firebase.child('users').child(provider).child(id).child('trackers').push();
    var globalTracker = firebase.child('trackers').push();
    globalTracker.set({
        owner: id,
        info_hash: info_hash,
        completed: 0,
        transferred: 0,
        src: src,
        labels: labels || [],
        time: new Date().getTime()
    });
    userTracker.set(globalTracker.name());
    return globalTracker.name();
}

var addFirebaseTorrent = function(firebase, tracker, torrent) {
    var file = URL.parse(torrent).pathname;
    file = file.substring(file.lastIndexOf('/'));
    var shortened = firebase.child('torrent').push({
        tracker: tracker,
        torrent: torrent
    });
    return 'http://torrent.todium.com/' + shortened.name() + '.torrent';
}

var addLinkRequest = function(firebase, provider, id, src, labels) {
    console.log('addLinkRequest', provider, id, src);

    var ret = new q.defer();
    if(src.indexOf(MAGNET_LINK_IDENTIFIER) === 0) {
        console.log('replacing magnet link');
        var info_hash = magnetLink.substr(MAGNET_LINK_IDENTIFIER.length, 40);
        var name = addFirebaseTracker(firebase, provider, id, info_hash, src, labels);
        var tracker = 'http://tracker.todium.com/' + name + '/announce'
        ret.resolve(src + '&tr=' + tracker);
    } else {
        console.log('replacing torrent file');
        request.get({
            url: 'http://hasher.todium.com?torrent=' + src, 
            json: true
        }, function (error, response, info_hash) {
            console.log(error, response.statusCode, info_hash);
            if(error || typeof info_hash !== 'string' || info_hash.length !== 40) {
                ret.reject(error);
                return;
            } else {
                var name = addFirebaseTracker(firebase, provider, id, info_hash, src, labels);
                var tracker = 'http://tracker.todium.com/' + name + '/announce';
                var torrent = addFirebaseTorrent(firebase, tracker, src);
                ret.resolve(torrent);
            }
        });
    } 
    return ret.promise;
}

var authenticateFirebaseRequest = function(firebase, token) {
    var ret = new q.defer();
    firebase.auth(token, function(error, info) {
        console.log('firebase auth', error, info);
        if(error) {
            ret.reject(error);
        } else {
           ret.resolve(info);
        }
    }, function(error) {
        ret.reject(error);
    });
    return ret.promise;
}

var port = process.env.PORT || 5050;
console.log('port', port);
http.createServer(function(req, res) {
    var query = URL.parse(req.url, true).query;

    // if we don't have a url argument, then lets bail
    if(!query.hasOwnProperty('token') ||
        !query.hasOwnProperty('src')
    ) {
        res.writeHead(400);
        res.end('src/token mandatory');
        return;
    }

    var token = query['token'];
    var src = query['src'];
    var labels = query['labels'];

    console.log('token', token.length, token);
    console.log('src', src.length, src);

    var firebase = new Firebase('https://featuredcontent.firebaseio.com/');
    var authenticationRequest = authenticateFirebaseRequest(firebase, token);

    var abort = function(err) {
        res.writeHead(400);
        res.end(err);
    };

    authenticationRequest.then(function(info) {
        var provider = info.auth.provider;
        var id = info.auth.id;
        addLinkRequest(firebase, provider, id, src, labels).then(function(link) {
            res.writeHead(200, headers);
            if(query.hasOwnProperty('callback')) {
                var callback = query['callback'];
                res.end(callback + '("' + link + '")');
            } else {
                res.end(link);
            }
            firebase.unauth();
        }, abort);
    }, abort);
}).listen(port, function() {
    console.log('Listening on ' + port);
});