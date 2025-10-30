const Client = require('./lib/client');
const Server = require('./lib/server');
const fs = require('fs');

// generate key if it doesn't exist
const keyPath = '/tmp/test_host_key_ssh2js';
if (!fs.existsSync(keyPath)) {
  require('child_process').execSync(
    `ssh-keygen -t ed25519 -f ${keyPath} -N "" -q`
  );
}

const server = new Server({
  hostKeys: [fs.readFileSync(keyPath)],
  algorithms: {
    kex: ['mlkem768x25519-sha256']
  }
}, (client) => {
  console.log('ssh2js client connected to ssh2js server');

  client.on('authentication', (ctx) => {
    if (ctx.method === 'password' &&
      ctx.username === 'testuser' &&
      ctx.password === 'testpass') {
      ctx.accept();
    } else {
      ctx.reject();
    }
  }).on('ready', () => {
    console.log('ssh2js client authenticated');

    client.on('session', (accept, reject) => {
      const session = accept();

      session.on('exec', (accept, reject, info) => {
        const stream = accept();
        stream.write('handshake successful!\n');
        stream.exit(0);
        stream.end();
      });
    });
  });
});

server.listen(2224, '0.0.0.0', function() {
  console.log('ssh2.js server listening on port 2224');

  setTimeout(() => {
    const conn = new Client();
    conn.on('ready', () => {
      console.log('');
      conn.exec('echo "test"', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
          console.log('success on command exec');
          conn.end();
          server.close();
          process.exit(0);
        }).on('data', (data) => {
          console.log('received output: ', data.toString().trim());
        });
      });
    }).on('error', (err) => {
      console.error('ssh2 client to ssh2 server connection failed');
      console.error('err:', err.message);
      server.close();
      process.exit(1);
    }).connect({
      host: 'localhost',
      port: 2224,
      username: 'testuser',
      password: 'testpass',
      algorithms: {
        kex: ['mlkem768x25519-sha256']
      },
      readyTimeout: 10000
    });
  }, 1000);
});
