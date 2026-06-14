'use strict';

const Client = require('../lib/client');
const { mlkemSupported } = require('../lib/protocol/constants');

const WARMUP = 20;
const N = 200;

const OPENSSH_HOST = process.env.OPENSSH_HOST || 'openssh-server';
const OPENSSH_PORT = parseInt(process.env.OPENSSH_PORT || '2222', 10);

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

function printTable(label, latencies, cpuUser, cpuSys, bytes) {
  const ls = stats(latencies);
  const us = stats(cpuUser);
  const ss = stats(cpuSys);
  const bs = stats(bytes);
  console.log(`\nAlgorithm: ${label} (N=${N}, warmup=${WARMUP})`);
  console.log('Metric                Mean      Stddev    p50       p95');
  console.log(`Latency (ms)      ${fmt(ls.mean)} ${fmt(ls.stddev)} ${fmt(ls.p50)} ${fmt(ls.p95)}`);
  console.log(`CPU user (μs)     ${fmt(us.mean, 0)} ${fmt(us.stddev, 0)} ${fmt(us.p50, 0)} ${fmt(us.p95, 0)}`);
  console.log(`CPU system (μs)   ${fmt(ss.mean, 0)} ${fmt(ss.stddev, 0)} ${fmt(ss.p50, 0)} ${fmt(ss.p95, 0)}`);
  console.log(`Bytes total       ${fmt(bs.mean, 0)} ${fmt(bs.stddev, 0)} ${fmt(bs.p50, 0)} ${fmt(bs.p95, 0)}`);
}

function runAlgo(algoName) {
  return new Promise((resolve, reject) => {
    const latencies = [];
    const cpuUser = [];
    const cpuSys = [];
    const bytesArr = [];
    let i = 0;

    function next() {
      if (i >= WARMUP + N) {
        resolve({ latencies, cpuUser, cpuSys, bytes: bytesArr });
        return;
      }

      const isWarmup = i < WARMUP;
      i++;

      const client = new Client();
      const t0 = process.hrtime.bigint();
      const cpu0 = process.cpuUsage();

      client.on('ready', () => {
        const latencyMs = Number(process.hrtime.bigint() - t0) / 1e6;
        const cpu1 = process.cpuUsage(cpu0);
        const bytes = client._sock.bytesRead + client._sock.bytesWritten;

        if (!isWarmup) {
          latencies.push(latencyMs);
          cpuUser.push(cpu1.user);
          cpuSys.push(cpu1.system);
          bytesArr.push(bytes);
        }

        client.end();
      });

      client.on('close', next);
      client.on('error', reject);

      client.connect({
        host: OPENSSH_HOST,
        port: OPENSSH_PORT,
        username: 'testuser',
        password: 'testpass',
        algorithms: { kex: [algoName] },
        readyTimeout: 10000,
      });
    }

    next();
  });
}

async function main() {
  console.log(`=== Scenario C — ssh2.js client -> OpenSSH server (${OPENSSH_HOST}:${OPENSSH_PORT}) ===`);

  const results = {};
  for (const algo of ALGOS) {
    process.stdout.write(`  Running ${algo}...`);
    results[algo] = await runAlgo(algo);
    console.log(' done.');
  }

  for (const algo of ALGOS) {
    const r = results[algo];
    printTable(algo, r.latencies, r.cpuUser, r.cpuSys, r.bytes);
  }

  const a = results['curve25519-sha256'];
  const b = results['mlkem768x25519-sha256'];
  const aLat = stats(a.latencies).mean;
  const bLat = stats(b.latencies).mean;
  const aCpu = stats(a.cpuUser).mean;
  const bCpu = stats(b.cpuUser).mean;
  const aBytes = stats(a.bytes).mean;
  const bBytes = stats(b.bytes).mean;

  console.log('\nOverhead (mlkem768x25519 vs curve25519):');
  console.log(`  Latency:   ${((bLat / aLat - 1) * 100).toFixed(1)}%`);
  console.log(`  CPU user:  ${((bCpu / aCpu - 1) * 100).toFixed(1)}%`);
  console.log(`  Bytes:     ${((bBytes / aBytes - 1) * 100).toFixed(1)}% (curve: ${Math.round(aBytes)}, mlkem: ${Math.round(bBytes)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
