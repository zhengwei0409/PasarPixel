const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(readFileSync(join(__dirname, '../src/lib/phantom.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture() {
    const provider = new EventEmitter();
    provider.isPhantom = true;
    provider.isConnected = true;
    provider.publicKey = { toString: () => 'wallet-a' };
    provider.connect = async () => ({ publicKey: provider.publicKey });
    provider.disconnect = async () => { provider.emit('disconnect'); };
    const storage = new Map();
    const window = new EventTarget();
    window.phantom = { solana: provider };
    window.sessionStorage = {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
    };
    const reload = () => {
        const exports = {};
        runInNewContext(compiled, { exports, window, Event, TextEncoder, URL, btoa });
        return exports;
    };
    return { provider, window, reload, connection: reload() };
}

test('disconnect stays disconnected when provider flags are stale and the window regains focus', async () => {
    const { provider, window, connection } = fixture();
    const snapshots = [];
    const unsubscribe = connection.subscribeToPhantom(() => snapshots.push(connection.getConnectedAddress()));
    assert.equal(connection.getConnectedAddress(), 'wallet-a');
    await provider.disconnect();
    assert.equal(connection.getConnectedAddress(), null);
    window.dispatchEvent(new Event('focus'));
    provider.emit('connect', provider.publicKey);
    assert.equal(connection.getConnectedAddress(), null);
    assert.ok(snapshots.length > 0);
    assert.ok(snapshots.every(value => value === null));
    unsubscribe();
});

test('manual disconnect stays disconnected across unsubscribe, remount and reload', async () => {
    const { provider, window, connection, reload } = fixture();
    const unsubscribe = connection.subscribeToPhantom(() => {});
    let disconnectCalls = 0;
    provider.disconnect = async () => { disconnectCalls++; };
    await connection.disconnectPhantom();
    assert.equal(disconnectCalls, 1);
    assert.equal(connection.getConnectedAddress(), null);
    unsubscribe();
    const next = reload();
    const cleanup = next.subscribeToPhantom(() => {});
    provider.emit('connect', provider.publicKey);
    window.dispatchEvent(new Event('focus'));
    assert.equal(next.getConnectedAddress(), null);
    cleanup();
});

test('only a successful explicit connection clears disconnect intent; rejected prompts remain disconnected', async () => {
    const { provider, connection } = fixture();
    const unsubscribe = connection.subscribeToPhantom(() => {});
    await connection.disconnectPhantom();
    provider.connect = async () => { throw new Error('User rejected'); };
    await assert.rejects(connection.connectPhantom(provider), /User rejected/);
    assert.equal(connection.getConnectedAddress(), null);
    provider.connect = async () => {
        provider.emit('connect', provider.publicKey);
        return { publicKey: provider.publicKey };
    };
    await connection.connectPhantom(provider);
    assert.equal(connection.getConnectedAddress(), 'wallet-a');
    unsubscribe();
});

test('failed disconnect restores the connected state and surfaces the error', async () => {
    const { provider, connection } = fixture();
    provider.disconnect = async () => { throw new Error('Disconnect failed'); };
    await assert.rejects(connection.disconnectPhantom(), /Disconnect failed/);
    assert.equal(connection.getConnectedAddress(), 'wallet-a');
});

test('accountChanged(null) respects disconnection even before the provider updates its public key', () => {
    const { provider, connection } = fixture();
    const cleanup = connection.subscribeToPhantom(() => {});
    provider.emit('accountChanged', null);
    assert.equal(connection.getConnectedAddress(), null);
    cleanup();
});

test('unsubscribe removes provider and window event listeners', () => {
    const { provider, window, connection } = fixture();
    let notifications = 0;
    const cleanup = connection.subscribeToPhantom(() => notifications++);
    cleanup();
    for (const event of ['connect', 'disconnect', 'accountChanged']) assert.equal(provider.listenerCount(event), 0);
    provider.emit('disconnect');
    window.dispatchEvent(new Event('focus'));
    assert.equal(notifications, 0);
});

test('manual disconnect still works when browser storage is unavailable', async () => {
    const { provider, window, connection } = fixture();
    window.sessionStorage = {
        getItem: () => { throw new Error('Storage blocked'); },
        setItem: () => { throw new Error('Storage blocked'); },
        removeItem: () => { throw new Error('Storage blocked'); },
    };
    await connection.disconnectPhantom();
    assert.equal(connection.getConnectedAddress(), null);
    await connection.connectPhantom(provider);
    assert.equal(connection.getConnectedAddress(), 'wallet-a');
});
