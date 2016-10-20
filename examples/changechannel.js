var watchAirManager = require('../index');
var path = require('path');

var args = process.argv.slice(process.argv.indexOf(__filename)+1);


if (args.length < 2) {
  var nm = path.basename(__filename);
  console.log(`Usage: ${nm} WatchAirIP UniqueChannelID (example: ${nm} 192.168.1.100 4)`)
  process.exit(1);
}

var session = new watchAirManager.WatchAirSession(args[0]);
process.stdout.write("Please wait, initializing watchAirSession...");
session.init().then(status => {
  process.stdout.write("done\n");
  process.stdout.write("Changing channel...");
  return session.changeChannel(args[1]);
}).then(url => {
  process.stdout.write("done\n");
  console.log(`Channel changed to ${args[1]}\nURL is: ${url}`);
});
