# mlkem/openssh/ssh2.js docker test
This branch implements ssh2.js tests with openssh 10.1.

## Prerequisites:
- Docker
- Docker compose

## How to run the tests

1 - `docker compose up --build -d` -> builds containers and runs them on background

2 - `docker compose exec ssh2js-test bash docker-tests.sh` -> runs `bash docker-tests.sh` on the `ssh2js-test` container

## Description

Basically, we'll have a container `openssh-server` that will run an openssh10.1 server. We'll also have a `ssh2js-test` container.
It'll run three scripts: `client-to-openssh.js`, `openssh-to-server.js` and `ssh2js-to-ssh2js.js`. 

- `client-to-openssh.js`: will instantiate an ssh2js client that accepts mlkem768x25519-sha256 as KEX algorithm. Then, it'll connect to the server on the `openssh-server` container.
- `openssh-to-server.js`: will instantiate an ssh2js server that accepts mlkem768x25519-sha256 as KEX algorithm. Then, it'll instantiate an openssh10.1 client that connects to it.
- `ssh2js-to-ssh2js.js`: will instantiate an ssh2js server that accepts mlkem768x25519-sha256 as KEX algorithm. Then, it'll instantiate an ssh2js client that connects to it.

The following diagram may be helpful:

<img width="1110" height="552" alt="image" src="https://github.com/user-attachments/assets/b5bd27e2-bd6d-49f3-b931-5cd4fefc7ecb" />
