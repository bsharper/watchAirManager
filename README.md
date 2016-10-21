# WatchAirSession

This is an unofficial package that allows you to connect to the WatchAir smart antenna [https://www.watchairtv.com/](https://www.watchairtv.com/)

Currently this package can:
 * Connect to a WatchAir device
 * Get what is currently being streamed
 * Get the full channel list
 * Change the channel and get the URL for the new channel. Once you have the URL, any video player that is  [HLS capable](https://en.wikipedia.org/wiki/HTTP_Live_Streaming) can play it.

Hopefully, I will add:
 * Automatic discovery of WatchAir device*
 * Simple recording (start / stop recording)
 * Determine if changing the channel will interfere with a recording
 * Get guide information (might not be possible, we'll see)

<sup>\* I have this working in test code using mDNS, but I'm hoping to find an mDNS package that doesn't need an external library like [Bonjour](https://developer.apple.com/bonjour/) or [Avahi](https://github.com/lathiat/avahi).</sup>

Probably won't add, but a list of lists isn't complete without a third:
 * Full recording and scheduling support
 * Holographic projection of streaming content

This library uses Promises for nearly everything because there is a lot of sequencing involved (e.g. get session ID, use session ID to request current channel, change to current channel, etc). The WatchAirSession is also an EventEmitter, check `instance.eventNames` to see what events are emitted. Also, several of the functions are memoized. A Promise is returned regardless, it just immediately resolves to the result.

## Install
````shell
npm install --save watchair-manager
# or
yarn add watchair-manager
````

## Example
````javascript
var watchAirManager = require('watchair-manager');

// The clientID is not required, but there might be advantages having a persistent clientID.
// The clientID is simply a V4 UUID in all uppercase.

var clientID = '72A2EFA5-0B27-4F97-93F9-827AECDC2E8A';
var ip = '192.168.1.88';

var session = new watchAirManager.WatchAirSession(ip, clientID);

session.init().then(status => {
	console.log(status); // 'initialized'
    return session.getChannels();
}).then(channels => {
	console.log(channels); // 'big list of channels'
    // pick a random uniqueID
    var ks = Object.keys(channels);
    var rand = ks[Math.floor(Math.random() * ks.length)];
    var uid = channels[rand].UniqueId;
    console.log(uid); // some random number (for example, 7)
    return session.changeChannel(uid);
}).then(url => {
	console.log(url);
	// feed the URL to an HLS capable video player
});
````

There are other examples in the `examples` folder.
