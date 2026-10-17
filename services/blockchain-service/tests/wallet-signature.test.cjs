const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const bs58 = require('bs58').default;
const { createChallengeMessage, parseWalletAddress, verifyWalletSignature, CHALLENGE_TTL_MS } = require('../dist/services/blockchain-service/src/lib/walletSignature');

function keypair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return { address: bs58.encode(publicKey.export({ type: 'spki', format: 'der' }).subarray(-32)), privateKey };
}

test('a real Ed25519 signature verifies only the exact wallet and server message', () => {
    const wallet = keypair();
    const { message } = createChallengeMessage('https://market.example', 12, wallet.address, new Date());
    const signature = sign(null, Buffer.from(message), wallet.privateKey).toString('base64');
    assert.equal(parseWalletAddress(wallet.address), wallet.address);
    assert.equal(verifyWalletSignature(wallet.address, message, signature), true);
    assert.equal(verifyWalletSignature(keypair().address, message, signature), false);
    assert.equal(verifyWalletSignature(wallet.address, message.replace('Account: 12', 'Account: 13'), signature), false);
    assert.equal(verifyWalletSignature(wallet.address, message.replace('market.example', 'other.example'), signature), false);
    for (const invalid of [null, '', [], signature.slice(1), Buffer.alloc(64).toString('base64'), '!'.repeat(88)]) {
        assert.equal(verifyWalletSignature(wallet.address, message, invalid), false);
    }
});

test('challenges include the configured site, account, Devnet and short expiry with independent nonces', () => {
    const now = new Date('2026-10-17T00:00:00Z');
    const address = keypair().address;
    const first = createChallengeMessage('http://localhost:5173', 12, address, now);
    const second = createChallengeMessage('http://localhost:5173', 12, address, now);
    assert.match(first.message, /Domain: localhost:5173\nURI: http:\/\/localhost:5173\/settings/);
    assert.match(first.message, /Network: Solana Devnet\nAccount: 12/);
    assert.equal(first.expiresAt.getTime() - now.getTime(), CHALLENGE_TTL_MS);
    assert.notEqual(first.message, second.message);
});

test('invalid, oversized and non-string addresses are rejected', () => {
    for (const value of [null, {}, [], '', '0'.repeat(32), '1'.repeat(31), '1'.repeat(44), 'x'.repeat(5000)]) {
        assert.throws(() => parseWalletAddress(value), /valid Solana wallet/);
    }
});
