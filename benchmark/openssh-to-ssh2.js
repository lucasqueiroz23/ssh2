'use strict';

const fs = require('fs');
const { execSync, spawn } = require('child_process');
const Server = require('../lib/server');
const { mlkemSupported } = require('../lib/protocol/constants');

const WARMUP = 20;
const N = 200;

const keyPath = '/tmp/bench_host_key_openssh_srv';
if (!fs.existsSync(keyPath)) {
  execSync(`ssh-keygen -t ed25519 -f ${keyPath} -N "" -q`);
}
const HOST_KEY = fs.readFileSync(keyPath);

const ALGOS = ['curve25519-sha256', 'mlkem768x25519-sha256'];

function stats(samples) {
  const n = samples.length;
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    mean,
    stddev: Math.sqrt(variance),
    p50: sorted[Math.floor(n * 0.50)],
    p95: sorted[Math.floor(n * 0.95)],
  };
}

function fmt(n, dec = 2) {
  return n.toFixed(dec).padStart(10);
}

function printTable(label, latencies, bytes) {
  const ls = stats(latencies);
  const bs = stats(bytes);
  console.log(`\nAlgorithm: ${label} (N=${N}, warmup=${WARMUP})`);
  console.log('Metric                Mean      Stddev    p50       p95');
  console.log(`Latency (ms)      ${fmt(ls.mean)} ${fmt(ls.stddev)} ${fmt(ls.p50)} ${fmt(ls.p95)}`);
  console.log(`Bytes total       ${fmt(bs.mean, 0)} ${fmt(bs.stddev, 0)} ${fmt(bs.p50, 0)} ${fmt(bs.p95, 0)}`);
}

function runAlgo(algoName) {
  return new Promise((resolve, reject) => {
    const srv = new Server({ hostKeys: [HOST_KEY], algorithms: { kex: [algoName] } });

    const latencies = [];
    const bytesArr = [];
    let i = 0;
    let port;

    srv.on('error', reject);

    function next() {
      if (i >= WARMUP + N) {
        srv.close();
        resolve({ latencies, bytes: bytesArr });
        return;
      }

      const isWarmup = i < WARMUP;
      i++;

      let capturedBytes = 0;

      srv.once('connection', (conn) => {
        conn.on('authentication', (ctx) => ctx.accept());
        conn.on('ready', () => {
          capturedBytes = conn._sock.bytesRead + conn._sock.bytesWritten;
          conn.on('session', (accept) => {
            const session = accept();
            session.on('exec', (accept) => {
              const stream = accept();
              stream.write('ok\n');
              stream.exit(0);
              stream.end();
            });
          });
        });
        conn.on('error', () => { });
      });

      const t0 = process.hrtime.bigint();
      const proc = spawn('ssh', [
        '-p', String(port),
        '-o', `KexAlgorithms=${algoName}`,
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-o', 'BatchMode=yes',
        'testuser@127.0.0.1',
        'echo ok',
      ]);

      proc.stdout.resume();
      proc.stderr.resume();

      proc.on('close', () => {
        const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
        if (!isWarmup) {
          latencies.push(latencyMs);
          bytesArr.push(capturedBytes);
        }
        next();
      });

      proc.on('error', reject);
    }

    srv.listen(0, '0.0.0.0', () => {
      port = srv.address().port;
      next();
    });
  });
}

async function main() {
  console.log('=== Scenario B — OpenSSH client -> ssh2.js server ===');

  const results = {};
  for (const algo of ALGOS) {
    process.stdout.write(`  Running ${algo}...`);
    results[algo] = await runAlgo(algo);
    console.log(' done.');
  }

  for (const algo of ALGOS) {
    const r = results[algo];
    printTable(algo, r.latencies, r.bytes);
  }

  const a = results['curve25519-sha256'];
  const b = results['mlkem768x25519-sha256'];
  const aLat = stats(a.latencies).mean;
  const bLat = stats(b.latencies).mean;
  const aBytes = stats(a.bytes).mean;
  const bBytes = stats(b.bytes).mean;

  console.log('\nOverhead (mlkem768x25519 vs curve25519):');
  console.log(`  Latency: ${((bLat / aLat - 1) * 100).toFixed(1)}%`);
  console.log(`  Bytes:   ${((bBytes / aBytes - 1) * 100).toFixed(1)}% (curve: ${Math.round(aBytes)}, mlkem: ${Math.round(bBytes)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
