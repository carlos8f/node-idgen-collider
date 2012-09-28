#!/usr/bin/env node
var program = require('commander')
  , resolve = require('path').resolve
  , version = require(resolve(__dirname, './package')).version

program
  .version(version)
  .option('-t, --threads <count>', 'number of threads to use (default: CPU count)', Number, require('os').cpus().length)
  .option('-s, --set <chars>', 'set of characters to use in hashes (default: a-zA-Z0-9)')
  .option('-l, --length <length>', 'character length of hashes (default: 8)')
  .option('--reset', 'reset the keyspace before starting')
  .parse(process.argv);

// Reduce commander's output to a regular object.
var keys = Object.keys(program).filter(function (k) {
  return !k.match(/^(commands|args|name|options|rawArgs|Command|Option)$|_/);
}), options = {};
keys.forEach(function (k) {
  options[k] = program[k];
});

var cluster = require('cluster')
  , workerCount = 0

cluster.setupMaster({
  exec: require('path').resolve(__dirname, './worker.js')
});

function fork () {
  var worker = cluster.fork();
  worker.send({cmd: 'OPTIONS', options: options});
  return worker;
}

// Auto-respawn
cluster.on('exit', function (worker, code, signal) {
  fork();
});

var client = require('redis').createClient();

if (program.reset) {
  client.DEL('idgen_collider');
}

setInterval(function () {
  client.scard('idgen_collider', function (err, keyspace) {
    if (err) throw err;
    console.log('keyspace: ' + keyspace);
  });
}, 10000);

for (var i = 0; i < options.threads; i++) {
  var worker = fork();
  worker.on('message', function (message) {
    if (message.cmd === 'COLLISION') {
      console.log('COLLISION FOUND!!! ');
      console.log(message);
      process.exit();
    }
    else if (message.cmd === 'UP') {
      workerCount++;
      if (workerCount === options.threads) {
        console.error('now colliding with ' + options.threads + ' threads...');
      }
    }
  });
}