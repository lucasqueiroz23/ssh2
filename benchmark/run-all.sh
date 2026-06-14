#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================================"
echo "  KEX Benchmark: mlkem768x25519-sha256 vs curve25519"
echo "========================================================"
echo ""

echo ">>> Scenario A: ssh2.js <-> ssh2.js"
node "$SCRIPT_DIR/ssh2-to-ssh2.js"

echo ""
echo ">>> Scenario B: OpenSSH client -> ssh2.js server"
node "$SCRIPT_DIR/openssh-to-ssh2.js"

echo ""
echo ">>> Scenario C: ssh2.js client -> OpenSSH server"
node "$SCRIPT_DIR/ssh2-to-openssh.js"

echo ""
echo "========================================================"
echo "  Done."
echo "========================================================"
