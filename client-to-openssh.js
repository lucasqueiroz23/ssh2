const Client = require('./lib/client');

// openssh server host and port
const host = 'openssh-server'
const port = 2222;

const conn = new Client();
conn.on('ready', () => {

  console.log('handshake successful!');

  conn.exec('echo "handshake successful!"', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => {
      console.log('success on command exec');
      conn.end();
      process.exit(0);
    }).on('data', (data) => {
      console.log('received output: ', data.toString().trim());
    }).stderr.on('data', (data) => {
      console.log('stderr: ', data.toString());
    });
  });

}).on('error', (err) => {
  console.error('handshake failed');
  console.error('error: ', err.message);
  process.exit(1);
}).connect({
  host,
  port,
  username: 'testuser',
  password: 'testpass',
  algorithms: {
    kex: ['mlkem768x25519-sha256']
  },
  readyTimeout: 10000,
  // NOTE: uncomment line below to check handshake
  // debug: console.log
});
