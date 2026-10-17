const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const window = new EventTarget();
window.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../src/lib/phantom.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject, window, Event, TextEncoder, URL, btoa });
const { bindPhantomWallet } = exportsObject;

function fixture() {
    const state = { signed: 0, verified: 0 };
    const publicKey = { toString: () => 'wallet-a' };
    const provider = {
        publicKey, isConnected: true,
        connect: async () => ({ publicKey }),
        signMessage: async (bytes, display) => {
            state.signed++;
            state.bytes = bytes;
            assert.equal(display, 'utf8');
            return { publicKey, signature: new Uint8Array(64).fill(42) };
        },
    };
    const challenge = {
        address: 'wallet-a', challengeId: 'challenge', network: 'solana:devnet',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        message: 'PasarPixel wallet binding\nDomain: localhost:5173\nURI: http://localhost:5173/settings\nNonce: a',
    };
    const api = {
        challenge: async () => challenge,
        verify: async (id, signature) => {
            state.verified++;
            assert.equal(id, 'challenge');
            assert.equal(Buffer.from(signature, 'base64').length, 64);
            return { wallet: { address: 'wallet-a' } };
        },
    };
    const run = (assertSession = () => {}) => bindPhantomWallet(provider, api, assertSession, 'http://localhost:5173');
    return { provider, api, challenge, state, run };
}

test('binding signs the exact server message and submits a base64 signature', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(result.wallet.address, 'wallet-a');
    assert.equal(Buffer.from(f.state.bytes).toString(), f.challenge.message);
    assert.equal(f.state.verified, 1);
});

test('rejects expired, wrong-wallet, wrong-network and wrong-origin requests before signing', async () => {
    for (const change of [
        c => { c.expiresAt = new Date(0).toISOString(); },
        c => { c.expiresAt = 'invalid'; },
        c => { c.address = 'wallet-b'; },
        c => { c.network = 'solana:mainnet'; },
        c => { c.message = c.message.replaceAll('localhost:5173', 'other.example'); },
        c => { c.message = 'arbitrary request'; },
    ]) {
        const f = fixture();
        change(f.challenge);
        await assert.rejects(f.run(), /does not match/);
        assert.equal(f.state.signed, 0);
        assert.equal(f.state.verified, 0);
    }
});

test('wallet switch or disconnect during the signature prompt does not submit a binding', async () => {
    for (const change of [p => { p.publicKey = { toString: () => 'wallet-b' }; }, p => { p.isConnected = false; }]) {
        const f = fixture();
        const sign = f.provider.signMessage;
        f.provider.signMessage = async (...args) => { const result = await sign(...args); change(f.provider); return result; };
        await assert.rejects(f.run(), /account changed/);
        assert.equal(f.state.verified, 0);
    }
});

test('a rejected signature, mismatched signer or changed login never binds', async () => {
    const rejected = fixture();
    rejected.provider.signMessage = async () => { throw new Error('User rejected'); };
    await assert.rejects(rejected.run(), /User rejected/);
    assert.equal(rejected.state.verified, 0);
    const wrong = fixture();
    wrong.provider.signMessage = async () => ({ publicKey: { toString: () => 'wallet-b' }, signature: new Uint8Array(64) });
    await assert.rejects(wrong.run(), /different wallet/);
    assert.equal(wrong.state.verified, 0);
    const session = fixture();
    let calls = 0;
    await assert.rejects(session.run(() => { if (++calls === 3) throw new Error('Login changed'); }), /Login changed/);
    assert.equal(session.state.verified, 0);
});
