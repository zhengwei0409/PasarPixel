const { mkdirSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');

const output = resolve(process.argv[2] || '.secrets/devnet-sponsor.json');
const keypair = createUmi('https://api.devnet.solana.com').eddsa.generateKeypair();
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
writeFileSync(output, JSON.stringify(Array.from(keypair.secretKey)), { flag: 'wx', mode: 0o600 });
console.log(`Dedicated Devnet sponsor wallet created: ${keypair.publicKey}`);
console.log('Fund this public address with Devnet SOL at https://faucet.solana.com/. Keep the key file private.');
