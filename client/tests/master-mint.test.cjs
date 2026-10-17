const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../src/lib/masterMint.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function fixture() {
    const state = { wallet: 'owner', signatures: 0 };
    const exports = {};
    runInNewContext(compiled, { exports, URL, TextEncoder, btoa, require: () => ({ getConnectedAddress: () => state.wallet }) });
    const provider = { publicKey: { toString: () => state.wallet }, signMessage: async bytes => {
        state.signatures++;
        state.bytes = Buffer.from(bytes).toString();
        return { publicKey: { toString: () => state.wallet }, signature: new Uint8Array(64).fill(1) };
    } };
    const master = { ownerAddress: 'owner', assetAddress: 'asset', metadataUri: 'https://example.com/metadata',
        authorization: { id: 'id', expiresAt: new Date(Date.now() + 60_000).toISOString(),
            message: 'PasarPixel Master NFT mint\nDomain: localhost:5173\nURI: http://localhost:5173/seller/listings\nNetwork: Solana Devnet\nOwner: owner\nAsset: asset\nMetadata: https://example.com/metadata\nAuthorization: id\nNonce: unique' } };
    const run = () => exports.signMasterMint(provider, master, 'http://localhost:5173');
    return { state, provider, master, run };
}

test('mint signs the exact server approval and returns only its ID and base64 signature', async () => {
    const f = fixture();
    const result = await f.run();
    assert.equal(f.state.bytes, f.master.authorization.message);
    assert.equal(result.authorizationId, 'id');
    assert.equal(Buffer.from(result.signature, 'base64').length, 64);
});

test('wrong site, network, NFT, owner, metadata or expired approval is rejected before signing', async () => {
    for (const mutate of [
        m => { m.authorization.expiresAt = new Date(0).toISOString(); },
        m => { m.authorization.message = m.authorization.message.replace('Domain: localhost:5173', 'Domain: evil.example'); },
        m => { m.authorization.message = m.authorization.message.replace('Solana Devnet', 'Solana Mainnet'); },
        m => { m.ownerAddress = 'other'; },
        m => { m.assetAddress = 'other'; },
        m => { m.metadataUri = 'https://evil.example'; },
        m => { m.authorization.id = 'other'; },
    ]) {
        const f = fixture(); mutate(f.master);
        await assert.rejects(f.run());
        assert.equal(f.state.signatures, 0);
    }
});

test('disconnect or wallet switch while approving cannot authorize a mint', async () => {
    for (const address of [null, 'other']) {
        const f = fixture();
        const original = f.provider.signMessage;
        f.provider.signMessage = async bytes => { const signed = await original(bytes); f.state.wallet = address; return signed; };
        await assert.rejects(f.run(), /bound/);
    }
});
