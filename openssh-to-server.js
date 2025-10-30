const fs = require('fs');
const { exec } = require('child_process');
const Server = require('./lib/server');

// generate a key if it doesn't exist
const keyPath = '/tmp/test_host_key';
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
  console.log('openssh client connected to ssh2 server');

  client.on('authentication', (ctx) => {
    if (ctx.method === 'password' &&
      ctx.username === 'testuser' &&
      ctx.password === 'testpass') {
      ctx.accept();
    } else {
      ctx.reject();
    }
  }).on('ready', () => {
    console.log('client authenticated');

    client.on('session', (accept, reject) => {
      const session = accept();

      session.on('exec', (accept, reject, info) => {
        const stream = accept();
        stream.write('handshake successful!\n');
        stream.exit(0);
        stream.end();

        setTimeout(() => {
          console.log('success');
          server.close();
          process.exit(0);
        }, 500);
      });
    });
  });
});

server.listen(2223, '0.0.0.0', function() {
  console.log('ssh2.js server listening on port 2223');

  // execute openssh10 client 1 second after ssh2.js server
  // starts
  setTimeout(() => {
    exec(
      'ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null ' +
      '-o KexAlgorithms=mlkem768x25519-sha256 -o LogLevel=ERROR ' +
      '-p 2223 testuser@localhost "echo test"',
      { env: { ...process.env, SSHPASS: 'testpass' } },
      (error, stdout, stderr) => {
        if (error) {
          console.error('failed');
          console.error('err:', error.message);
          process.exit(1);
        }
      }
    );
  }, 1000);
});
