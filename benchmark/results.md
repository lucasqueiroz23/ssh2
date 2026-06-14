# KEX Benchmark Results: mlkem768x25519-sha256 vs curve25519-sha256

## Environment

| | |
|---|---|
| **Node.js** | v24 (inside Docker) |
| **OpenSSH** | 10.1p1 (inside Docker) |
| **OS** | Ubuntu 24.04 |
| **Iterations** | N=200, warmup=20 (discarded) |
| **Execution** | Sequential handshakes (no concurrency) |

All scenarios run inside Docker (`ssh2js-test` container) for consistency.

## Theoretical KEX Payload Sizes

| Algorithm | Client → Server | Server → Client |
|---|---|---|
| `curve25519-sha256` | `KEXDH_INIT` = 32 B | `KEXDH_REPLY` = 32 B |
| `mlkem768x25519-sha256` | `KEX_HYBRID_INIT` = 1216 B (1184 B ML-KEM-768 pubkey + 32 B X25519) | `KEX_HYBRID_REPLY` = 1120 B (1088 B ML-KEM-768 ciphertext + 32 B X25519) |

---

## Scenario A — ssh2.js ↔ ssh2.js

Both client and server are ssh2.js running in the same container.

### Absolute values

#### Latency (ms) — time from `connect()` to `ready` event

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 42.96 | 43.24 |
| Stddev | 0.53 | 0.69 |
| p50 | 42.80 | 42.88 |
| p95 | 43.94 | 44.64 |

#### CPU user time (μs)

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 2031 | 2444 |
| Stddev | 1508 | 1222 |
| p50 | 2008 | 2332 |
| p95 | 3668 | 4196 |

#### CPU system time (μs)

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 597 | 509 |
| Stddev | 675 | 670 |
| p50 | 118 | 31 |
| p95 | 1986 | 1770 |

#### Total bytes transferred per handshake

| | curve25519 | mlkem768x25519 |
|---|---|---|
| Bytes | 2104 | 4376 |

### Overhead (mlkem768x25519 vs curve25519)

| Metric | curve25519 | mlkem768x25519 | Overhead |
|---|---|---|---|
| Latency mean (ms) | 42.96 | 43.24 | **+0.7%** |
| CPU user mean (μs) | 2031 | 2444 | **+20.3%** |
| Bytes total | 2104 | 4376 | **+108.0%** |

---

## Scenario B — OpenSSH client → ssh2.js server

OpenSSH 10.1p1 client connects to a ssh2.js server. Latency is measured as subprocess wall time (spawn to exit). CPU not reported (OpenSSH runs as a subprocess).

### Absolute values

#### Latency (ms) — subprocess wall time

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 94.72 | 95.44 |
| Stddev | 5.67 | 5.67 |
| p50 | 93.94 | 94.70 |
| p95 | 96.12 | 97.18 |

#### Total bytes transferred per handshake (server-side socket)

| | curve25519 | mlkem768x25519 |
|---|---|---|
| Bytes | 2600 | 4872 |

### Overhead (mlkem768x25519 vs curve25519)

| Metric | curve25519 | mlkem768x25519 | Overhead |
|---|---|---|---|
| Latency mean (ms) | 94.72 | 95.44 | **+0.8%** |
| Bytes total | 2600 | 4872 | **+87.4%** |

---

## Scenario C — ssh2.js client → OpenSSH server

ssh2.js client connects to the OpenSSH 10.1p1 server (`openssh-server:2222`).

### Absolute values

#### Latency (ms) — time from `connect()` to `ready` event

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 87.53 | 87.82 |
| Stddev | 0.79 | 0.75 |
| p50 | 87.50 | 87.69 |
| p95 | 88.83 | 89.24 |

#### CPU user time (μs)

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 2296 | 2396 |
| Stddev | 1202 | 858 |
| p50 | 2284 | 2507 |
| p95 | 3498 | 3644 |

#### CPU system time (μs)

| Metric | curve25519 | mlkem768x25519 |
|---|---|---|
| Mean | 622 | 624 |
| Stddev | 630 | 665 |
| p50 | 433 | 339 |
| p95 | 2029 | 2014 |

#### Total bytes transferred per handshake

| | curve25519 | mlkem768x25519 |
|---|---|---|
| Bytes | 2632 | 4904 |

### Overhead (mlkem768x25519 vs curve25519)

| Metric | curve25519 | mlkem768x25519 | Overhead |
|---|---|---|---|
| Latency mean (ms) | 87.53 | 87.82 | **+0.3%** |
| CPU user mean (μs) | 2296 | 2396 | **+4.3%** |
| Bytes total | 2632 | 4904 | **+86.3%** |

---

## Summary

| Scenario | Latency overhead | CPU user overhead | Bytes overhead |
|---|---|---|---|
| A: ssh2.js ↔ ssh2.js | +0.7% | +20.3% | +108.0% |
| B: OpenSSH client → ssh2.js server | +0.8% | N/A | +87.4% |
| C: ssh2.js client → OpenSSH server | +0.3% | +4.3% | +86.3% |

**Key observations:**
- Packet size roughly doubles across all scenarios (~86–108% more bytes), consistent with the theoretical KEX payload increase (32 B → 2336 B for the two KEX messages combined).
- Latency overhead is negligible (<1%) across all scenarios: on a fast link, the extra bytes fit within the same TCP segments and do not add round trips.
- CPU user time increases moderately (4–20%), reflecting the cost of ML-KEM-768 encapsulation/decapsulation on top of X25519.
