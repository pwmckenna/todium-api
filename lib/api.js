(function () {
    "use strict";

    var express = require('express');
    var Firebase = require('./firebase-node');
    var http = require('http');
    var URL = require('url');
    var q = require('q');
    var request = require('request');
    var sha1 = require('sha1');

    var MAGNET_LINK_IDENTIFIER = 'magnet:?xt=urn:btih:';
    var root = new Firebase('https://todium.firebaseio.com/');

    var addFirebaseTracker = function(firebase, id, info_hash, src) {
        var globalTrackerId = sha1(sha1(id) + sha1(info_hash));
        console.log('addFirebaseTracker', id, info_hash, src, globalTrackerId);

        var campaignTracker = firebase.child('campaigns').child(id).child('trackers').child(info_hash);
        console.log('globalTrackerId', globalTrackerId);
        var globalTracker = firebase.child('trackers').child(globalTrackerId);

        globalTracker.child('time').once('value', function (valueSnapshot) {
            if (!valueSnapshot.val()) {
                globalTracker.child('time').set(new Date().getTime());
            }
        });
        globalTracker.child('info_hash').set(info_hash);
        globalTracker.child('campaign').set(id);
        
        campaignTracker.set(globalTrackerId);
        return globalTracker;
    };

    var addFirebaseTorrent = function(firebase, id, tracker, torrent) {
        var torrentId = sha1(tracker);
        console.log('addFirebaseTorrent', id, tracker, torrent, torrentId);
        var file = URL.parse(torrent).pathname;
        file = file.substring(file.lastIndexOf('/'));
        firebase.child('torrent').child(torrentId).child('tracker').set(tracker);
        firebase.child('torrent').child(torrentId).child('torrent').set(torrent);
        firebase.child('torrent').child(torrentId).child('campaign').set(id);
        return 'http://torrent.todium.com/' + torrentId + '.torrent';
    };

    var addInfoHashLinkRequest = function (firebase, id, src) {
        var info_hash = src;
        var tracker = addFirebaseTracker(firebase, id, info_hash, MAGNET_LINK_IDENTIFIER + info_hash);
        var url = 'http://tracker.todium.com/' + tracker.name() + '/announce';
        var trackable = MAGNET_LINK_IDENTIFIER + info_hash + '&tr=' + url;
        tracker.child('trackable').set(trackable);
        return q.resolve(url);
    };

    var addMagnetLinkRequest = function (firebase, id, src) {
        console.log('replacing magnet link');
        var info_hash = src.substr(MAGNET_LINK_IDENTIFIER.length, 40);
        var tracker = addFirebaseTracker(firebase, id, info_hash, src);
        var url = 'http://tracker.todium.com/' + tracker.name() + '/announce';
        var trackable = src + '&tr=' + url;
        tracker.child('trackable').set(trackable);
        return q.resolve(trackable);
    };

    var addTorrentLinkRequest = function (firebase, id, src) {
        var ret = q.defer();
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
            } else {
                var tracker = addFirebaseTracker(firebase, id, info_hash, src);
                var url = 'http://tracker.todium.com/' + tracker.name() + '/announce';
                var trackable = addFirebaseTorrent(firebase, id, url, src);
                tracker.child('trackable').set(trackable);
                ret.resolve(trackable);
            }
        });
        return ret.promise;
    };

    var addLinkRequest = function(firebase, id, src) {
        console.log('addLinkRequest', id, src);

        if(src.match(/[0-9A-Fa-f]{40}/)) {
            return addInfoHashLinkRequest(firebase, id, src);
        } else if(src.indexOf(MAGNET_LINK_IDENTIFIER) === 0) {
            return addMagnetLinkRequest(firebase, id, src);
        } else {
            return addTorrentLinkRequest(firebase, id, src);
        } 
    };

    var authenticationRequest = function(firebase, id, secret) {
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

    var port = process.env.PORT || 5000;
    var app = express();
    app.use(function(req, res, next) {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

        // intercept OPTIONS method
        if (req.method === 'OPTIONS') {
            res.send(200);
        } else {
            next();
        }
    });
    app.use(express.bodyParser());
    var handlePost = function(req, res) {
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

        authenticationRequest(root, id, secret).then(function() {
            addLinkRequest(root, id, src).then(function(link) {
                res.send(200, link);
            }, abort);
        }, abort);
    };
    app.post('/', handlePost).post('/tracker', handlePost).listen(port, function() {
        console.log('Listening on ' + port);
    });
}());