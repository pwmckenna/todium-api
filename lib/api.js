/*
 * benc2json
 * https://github.com/pwmckenna/benc2json
 *
 * Copyright (c) 2013 Patrick Williams
 * Licensed under the MIT license.
 */
var express = require('express');
var Firebase = require('./firebase-node');
var http = require('http');
var URL = require('url');
var q = require('q');
var request = require('request');
var URL = require('url');

var MAGNET_LINK_IDENTIFIER = 'magnet:?xt=urn:btih:';
var firebase = new Firebase('https://todium.firebaseio.com/');

var addFirebaseTracker = function(firebase, id, info_hash, src) {
    console.log('addFirebaseTracker', id, info_hash, src);

    var campaignTracker = firebase.child('campaigns').child(id).child('trackers').push();
    var globalTracker = firebase.child('trackers').push();
    globalTracker.set({
        campaign: id,
        info_hash: info_hash,
        stats: {
            completed: 0,
            transferred: 0,
        },
        src: src,
        time: new Date().getTime()
    });
    campaignTracker.set(globalTracker.name());
    return globalTracker;
}

var addFirebaseTorrent = function(firebase, id, tracker, torrent) {
    var file = URL.parse(torrent).pathname;
    file = file.substring(file.lastIndexOf('/'));
    var shortened = firebase.child('torrent').push({
        tracker: tracker,
        torrent: torrent,
        campaign: id
    });
    return 'http://torrent.todium.com/' + shortened.name() + '.torrent';
}

var addLinkRequest = function(firebase, id, src) {
    console.log('addLinkRequest', id, src);

    var ret = new q.defer();
    if(src.indexOf(MAGNET_LINK_IDENTIFIER) === 0) {
        console.log('replacing magnet link');
        var info_hash = magnetLink.substr(MAGNET_LINK_IDENTIFIER.length, 40);
        var tracker = addFirebaseTracker(firebase, id, info_hash, src);
        var url = 'http://tracker.todium.com/' + tracker.name() + '/announce';
        var trackable = src + '&tr=' + url;
        tracker.child('trackable').set(trackable);
        ret.resolve(trackable);
    } else {
        console.log('replacing torrent file', src);
        request.get({
            url: 'http://hasher.todium.com',
            qs: {
                torrent: src
            },
            json: true
        }, function (error, response, info_hash) {
            console.log(error, response.statusCode, info_hash);
            if(error || typeof info_hash !== 'string' || info_hash.length !== 40) {
                ret.reject(error);
                return;
            } else {
                var tracker = addFirebaseTracker(firebase, id, info_hash, src);
                var url = 'http://tracker.todium.com/' + tracker.name() + '/announce';
                var trackable = addFirebaseTorrent(firebase, id, url, src);
                tracker.child('trackable').set(trackable);
                ret.resolve(trackable);
            }
        });
    } 
    return ret.promise;
};

var authenticationRequest = function(id, secret) {
    console.log('authenticationRequest', id, secret);
    var ret = new q.defer();
    firebase.child('campaigns').child(id).child('secret').once('value', function(secretSnapshot) {
        if(secretSnapshot.val() !== secret) {
            var error = 'invalid campaign secret';
            console.error(error);
            return ret.reject(error);
        } else {
            return ret.resolve();
        }
    });
    return ret.promise;
};

var port = process.env.PORT || 5050;
console.log('port', port);
var app = express();
app.use(express.bodyParser());
app.post('/', function(req, res) {
    var abort = function(err) {
        res.send(400, err);
    };

    // if we don't have a url argument, then lets bail
    if(!req.body.hasOwnProperty('id') ||
        !req.body.hasOwnProperty('secret') ||
        !req.body.hasOwnProperty('src')
    ) {
        abort('src/id/secret mandatory');
        return;
    }
    var id = req.body['id'];
    var secret = req.body['secret'];
    var src = req.body['src'];

    console.log('id', id);
    console.log('secret', secret);
    console.log('src', src);

    authenticationRequest(id, secret).then(function() {
        addLinkRequest(firebase, id, src).then(function(link) {
            res.send(200, link);
        }, abort);
    }, abort);
}).listen(port, function() {
    console.log('Listening on ' + port);
});