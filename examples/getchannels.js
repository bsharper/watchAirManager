var watchAirManager = require('../index');
var path = require('path');

var args = process.argv.slice(process.argv.indexOf(__filename)+1);


if (args.length === 0) {
  var nm = path.basename(__filename);
  console.log(`Usage: ${nm} WatchAirIP (example: ${nm} 192.168.1.100)`)
  process.exit(1);
}

var session = new watchAirManager.WatchAirSession(args[0]);
session.init().then(status => {
  return session.getChannels();
}).then(channels => {
  console.log(channels);
});
