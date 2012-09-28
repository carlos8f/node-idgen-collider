var idgen = require('idgen');

process.on('message', function (message) {
  if (message.cmd === 'OPTIONS') {
    start(message.options);
  }
});

function start (options) {
  var client = require('redis').createClient();
  client.on('connect', function () {
    process.send({cmd: 'UP'});
    (function gen () {
      var hash = idgen(options.length, options.set);
      client.SISMEMBER('idgen_collider', hash, function (err, collision) {
        if (err) throw err;
        if (collision) {
          client.SCARD('idgen_collider', function (err, keyspace) {
            if (err) throw err;
            process.send({cmd: 'COLLISION', hash: hash, keyspace: keyspace});
          });
        }
        else {
          client.SADD('idgen_collider', hash, gen);
        }
      });
    })();
  });
}