const http = require('http');
const util = require('util');
const querystring = require('querystring');
const url = require('url');

var Promise = require('bluebird');

const headers = {
  'Accept': '*/*',
  'Accept-Language': 'en-us',
  'Connection': 'keep-alive',
  'Accept-Encoding': 'gzip, deflate',
  'User-Agent': 'WatchAir/10030 CFNetwork/808.1.3 Darwin/16.1.0'
}

var debug = false;


function requestPromise(opts) {
  return new Promise(function (resolve, reject) {
    var postData = querystring.stringify(opts.qs);
    var uri = opts.uri || opts.url;
    var purl = url.parse(uri);

    var options = {
      hostname: purl.hostname,
      port: parseInt(opts.port) || parseInt(purl.port) || 80,
      path: purl.path + '?' + postData,
      headers: headers,
      method: 'GET'
    };
    if (debug) console.log("url.parse", purl);
    if (debug) console.log("request options", options);

    var req = http.request(options, function(res) {
      var data = [];
      if (debug) console.log("status code" + res.statusCode);
      res.on('data', function (chunk) {
        data.push(chunk);
      });
      res.on('end', function () {
        var fulldata = data.join('');
        if (debug) console.log(fulldata);
        resolve(fulldata);
      });
    });

    req.on('error', function(e) {
      reject(e.message);
    });

    req.end();
  })

}

exports.requestPromise = requestPromise;
exports.toggleDebug = function (tf) { debug = tf }
