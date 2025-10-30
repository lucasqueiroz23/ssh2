#!/bin/bash
set -e

echo "node version: $(node --version)"
echo "openssh version: $(/usr/local/bin/ssh -V 2>&1)"
echo ""

echo "Test 1: ssh2.js client to openssh 10.1 server"
echo "----------------------------------------------"
echo ""

sleep 2 
node client-to-openssh.js
echo ""

echo "Test 2: openssh 10.1 client to ssh2.js server"
echo "----------------------------------------------"
echo ""
node openssh-to-server.js
echo ""

echo "Test 3: ssh2.js client to ssh2.js server"
echo "----------------------------------------------"
echo ""
node ssh2js-to-ssh2js.js
echo ""
