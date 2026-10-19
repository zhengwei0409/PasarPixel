const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');

const code = ts.transpileModule(readFileSync(join(__dirname, '../src/components/settings/WalletSection.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function render({ linked = null, connected = null, canChange = true, lockedReason = null, loading = false, error = false } = {}) {
    const actions = [];
    const buttons = [];
    const mutation = name => ({ isPending: false, isError: false, reset() {}, mutate() { actions.push(name); } });
    const exports = {};
    runInNewContext(code, { exports, require: name => {
        if (['react/jsx-runtime', 'lucide-react'].includes(name)) return require(name);
        if (name === '@/hooks/useWallet') return { useWallet: () => ({
            connectedAddress: connected,
            status: { data: { wallet: linked ? { address: linked } : null, canChange, lockedReason }, isPending: loading, isError: error, refetch() {} },
            connect: mutation('connect'), bind: mutation('bind'), disconnect: mutation('disconnect'),
        }) };
        if (name === '@/components/ui/button') return { Button: ({ children, variant, ...props }) => {
            buttons.push({ label: children, ...props });
            return React.createElement('button', props, children);
        } };
        if (name === '@/lib/errors') return { getErrorMessage: (_, fallback) => fallback };
        throw new Error(`Unexpected dependency ${name}`);
    } });
    const html = renderToStaticMarkup(React.createElement(exports.default));
    assert.deepEqual(actions, []);
    return { html, actions, button: label => buttons.find(button => button.label === label) };
}

test('connecting an unlinked account is a separate action from verification', () => {
    const ui = render();
    assert.match(ui.html, /Phantom not connected/);
    assert.match(ui.html, /Connecting Phantom does not link a wallet/);
    assert.equal(ui.button('Verify & link wallet'), undefined);
    ui.button('Connect Phantom').onClick();
    assert.deepEqual(ui.actions, ['connect']);
});

test('detected wallet is explicitly not linked until the user verifies', () => {
    const ui = render({ connected: 'detected-address' });
    assert.match(ui.html, /Wallet detected · Not linked/);
    assert.match(ui.html, /Detected Phantom wallet/);
    assert.match(ui.html, /detected-address/);
    assert.equal(ui.button('Connect Phantom'), undefined);
    ui.button('Verify & link wallet').onClick();
    assert.deepEqual(ui.actions, ['bind']);
});

test('a saved wallet can reconnect without signing another binding', () => {
    const ui = render({ linked: 'saved-address' });
    assert.match(ui.html, /Linked wallet not connected/);
    assert.match(ui.html, /saved-address/);
    assert.equal(ui.button('Verify & link wallet'), undefined);
    ui.button('Connect Phantom').onClick();
    assert.deepEqual(ui.actions, ['connect']);
});

test('matching wallet is ready with no link or reconnect action', () => {
    const ui = render({ linked: 'saved-address', connected: 'saved-address' });
    assert.match(ui.html, /Linked wallet connected/);
    assert.equal(ui.button('Connect Phantom'), undefined);
    assert.equal(ui.button('Verify & link wallet'), undefined);
    assert.equal(ui.button('Verify & change linked wallet'), undefined);
});

test('mismatch explains how to select the linked wallet without fake or unavailable actions', () => {
    const ui = render({ linked: 'saved-address', connected: 'different-address', canChange: false, lockedReason: 'NFT_OWNERSHIP' });
    assert.match(ui.html, /Phantom connected · Different wallet selected/);
    assert.match(ui.html, /Phantom is using a different wallet/);
    assert.match(ui.html, /saved-address/);
    assert.match(ui.html, /different-address/);
    assert.match(ui.html, /Open the Phantom extension and select your linked wallet/);
    assert.equal(ui.button('Switch wallet in Phantom'), undefined);
    assert.equal(ui.button('Disconnect Phantom'), undefined);
    assert.equal(ui.button('Change linked wallet'), undefined);
    assert.doesNotMatch(ui.html, /Get Phantom/);
    assert.match(ui.html, /<details[^>]*><summary[^>]*>Detected Phantom wallet[\s\S]*Disconnect this detected wallet[\s\S]*<\/details>/);
    assert.match(ui.html, /Your linked wallet stays saved/);
    ui.button('Disconnect this detected wallet').onClick();
    assert.deepEqual(ui.actions, ['disconnect']);
    assert.equal(ui.button('Verify & change linked wallet'), undefined);
    assert.equal(ui.button('Verify & link wallet'), undefined);
});

test('changing an eligible linked wallet requires a separate explicit action', () => {
    const ui = render({ linked: 'saved-address', connected: 'different-address' });
    assert.equal(ui.button('Switch wallet in Phantom'), undefined);
    assert.match(ui.html, /<summary[^>]*>Change linked wallet<\/summary>/);
    assert.equal(ui.button('Verify & change linked wallet').disabled, false);
    ui.button('Verify & change linked wallet').onClick();
    assert.deepEqual(ui.actions, ['bind']);
});

test('pending transactions prevent wallet replacement', () => {
    const ui = render({ linked: 'saved-address', canChange: false, lockedReason: 'PENDING_TRANSACTION' });
    assert.match(ui.html, /cannot be changed while transactions are pending/);
    assert.equal(ui.button('Change linked wallet'), undefined);
    assert.equal(ui.button('Verify & change linked wallet'), undefined);
});

test('loading or failed wallet status never offers connection or binding actions', () => {
    for (const state of [{ loading: true }, { error: true }]) {
        const ui = render(state);
        assert.equal(ui.button('Connect Phantom'), undefined);
        assert.equal(ui.button('Verify & link wallet'), undefined);
        assert.equal(ui.button('Verify & change linked wallet'), undefined);
    }
});
