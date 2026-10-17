const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign, randomBytes } = require('node:crypto');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const bs58 = require('bs58').default;
const { PrismaClient } = require('../generated/client');
const { masterMintService } = require('../dist/services/masterMint.service');
const { walletService } = require('../dist/services/wallet.service');
const { MintBuildError } = require('../dist/lib/coreMint');
const { createApp } = require('../dist/app');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a disposable local database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local database required');
const schema = `mint_test_${randomBytes(8).toString('hex')}`;
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
let server, options, service;
let nextId = 1;
const chain = { builds: 0, sends: [], persistedBeforeSend: false, state: 'PENDING', failSend: false, failBuild: false };
const owners = new Map();
const unavailable = new Set();
const gateway = {
    assetAddress: () => keypair().address,
    build: async () => {
        if (chain.failBuild) throw new MintBuildError('Platform Devnet wallet needs funding');
        chain.builds++;
        return { signature: `signature-${chain.builds}`, transaction: Uint8Array.from([chain.builds]), lastValidBlockHeight: 99n };
    },
    send: async bytes => {
        chain.persistedBeforeSend = Boolean(await db.masterMintAttempt.findFirst({ where: { transaction: Buffer.from(bytes) } }));
        chain.sends.push(Buffer.from(bytes).toString('hex'));
        if (chain.failSend) throw new Error('RPC timeout');
    },
    reconcile: async () => chain.state,
};
function keypair() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return { address: bs58.encode(publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)), sign: text => sign(null, Buffer.from(text), privateKey).toString('base64') };
}
async function fixture() {
    const id = nextId++;
    const key = keypair();
    await db.wallet.create({ data: { userId: id, address: key.address } });
    owners.set(id, id);
    const prepare = () => service.prepare(id, id, 'Bearer seller-test');
    const approve = result => service.authorize(id, id, result.master.authorization.id, key.sign(result.master.authorization.message), 'Bearer seller-test');
    return { id, key, prepare, approve };
}
before(async () => {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
        cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    server = createServer((req, res) => {
        if (req.url === '/auth/me') {
            const match = /^Bearer (seller|buyer)-(\d+)$/.exec(req.headers.authorization ?? '');
            res.setHeader('content-type', 'application/json');
            if (!match) { res.writeHead(401).end('{}'); return; }
            res.end(JSON.stringify({ userId: Number(match[2]), roles: [match[1] === 'seller' ? 'SELLER' : 'BUYER'] }));
            return;
        }
        const id = Number(req.url.split('/')[2]);
        res.setHeader('content-type', 'application/json');
        if (unavailable.has(id) || !owners.has(id)) { res.writeHead(404).end('{}'); return; }
        res.end(JSON.stringify({ id, assetId: id, sellerId: owners.get(id), title: 'Master', listingRef: `ref-${id}`,
            manifestHash: 'a'.repeat(64), manifestUri: 'https://example.com/manifest', previewUri: 'https://example.com/preview' }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    options = { gateway, mainApiUrl: `http://127.0.0.1:${server.address().port}`, publicApiUrl: 'http://localhost:8000', clientOrigin: 'http://localhost:5173' };
    service = masterMintService(db, options);
});
after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
});

test('unapproved listings and other sellers cannot reserve a mint operation', async () => {
    const f = await fixture();
    unavailable.add(f.id);
    await assert.rejects(f.prepare(), /approved/);
    assert.equal(await db.masterNft.count({ where: { assetId: f.id } }), 0);
    unavailable.delete(f.id);
    owners.set(f.id, f.id + 1000);
    await assert.rejects(f.prepare(), /approved/);
});

test('concurrent prepare yields one Master record, fixed metadata, and a pending wallet lock', async () => {
    const f = await fixture();
    await Promise.all([f.prepare(), f.prepare()]);
    assert.equal(await db.masterNft.count({ where: { assetId: f.id } }), 1);
    const ready = await f.prepare();
    assert.equal(ready.master.status, 'AWAITING_SIGNATURE');
    const wallet = await walletService(db, options.clientOrigin).getStatus(f.id);
    assert.equal(wallet.lockedReason, 'PENDING_TRANSACTION');
    const metadata = await db.nftMetadata.findFirstOrThrow();
    await assert.rejects(db.nftMetadata.update({ where: { hash: metadata.hash }, data: { body: '{}' } }), /immutable/);
    await assert.rejects(db.nftMetadata.delete({ where: { hash: metadata.hash } }), /immutable/);
});

test('wrong signer, expired approval, replay and moderation changes cannot authorize a mint', async () => {
    const f = await fixture();
    const prepared = await f.prepare();
    await assert.rejects(service.authorize(f.id, f.id, prepared.master.authorization.id, keypair().sign(prepared.master.authorization.message), 'Bearer seller-test'), /verified/);
    unavailable.add(f.id);
    await assert.rejects(f.approve(prepared), /approved/);
    unavailable.delete(f.id);
    await db.masterNft.update({ where: { assetId: f.id }, data: { authorizationExpiresAt: new Date(0) } });
    await assert.rejects(f.approve(prepared), /expired/);
    const renewed = await f.prepare();
    await f.approve(renewed);
    await assert.rejects(f.approve(renewed), /expired/);
    // Complete fixture separately so later worker tests have no pending jobs.
    await db.masterNft.update({ where: { assetId: f.id }, data: { status: 'FAILED' } });
});

test('a send timeout and worker restart rebroadcast the exact stored bytes without rebuilding', async () => {
    const f = await fixture();
    await f.approve(await f.prepare());
    const before = chain.builds;
    chain.failSend = true;
    chain.state = 'PENDING';
    await service.tick();
    assert.equal(chain.builds, before + 1);
    assert.equal(chain.persistedBeforeSend, true);
    const attempt = await db.masterMintAttempt.findFirstOrThrow({ where: { masterNft: { assetId: f.id } } });
    assert.equal((await service.status(f.id, f.id)).master.status, 'PENDING');
    const restarted = masterMintService(db, options);
    chain.failSend = false;
    await restarted.tick();
    assert.equal(chain.builds, before + 1);
    assert.equal(chain.sends.at(-1), Buffer.from(attempt.transaction).toString('hex'));
    chain.state = 'READY';
    await restarted.tick();
    assert.equal((await restarted.status(f.id, f.id)).master.status, 'READY');
    assert.equal((await walletService(db, options.clientOrigin).getStatus(f.id)).lockedReason, 'NFT_OWNERSHIP');
    const repeated = await f.prepare();
    assert.equal(repeated.master.assetAddress, (await restarted.status(f.id, f.id)).master.assetAddress);
    assert.equal(chain.builds, before + 1);
});

test('a definite pre-send failure allows retry with the same NFT address; an RPC outage does not unlock it', async () => {
    const f = await fixture();
    const initial = await f.prepare();
    await f.approve(initial);
    chain.failBuild = true;
    await service.tick();
    assert.equal((await service.status(f.id, f.id)).master.status, 'FAILED');
    assert.equal((await walletService(db, options.clientOrigin).getStatus(f.id)).canChange, true);
    chain.failBuild = false;
    const retry = await f.prepare();
    assert.equal(retry.master.assetAddress, initial.master.assetAddress);
    await f.approve(retry);
    chain.state = 'PENDING';
    await service.tick();
    const offline = masterMintService(db, { ...options, gateway: { ...gateway, reconcile: async () => { throw new Error('RPC offline'); } } });
    await offline.tick();
    assert.equal((await offline.status(f.id, f.id)).master.status, 'PENDING');
    assert.equal((await walletService(db, options.clientOrigin).getStatus(f.id)).canChange, false);
    chain.state = 'FAILED';
    await service.tick();
    assert.equal((await service.status(f.id, f.id)).master.status, 'FAILED');
});

test('public metadata requires no login, mint API requires seller access and hidden configuration fails safely', async () => {
    const f = await fixture();
    const prepared = await f.prepare();
    const app = createServer(createApp(db, options.mainApiUrl, options.clientOrigin, options));
    await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.address().port}`;
    try {
        const metadata = await fetch(`${base}/blockchain/metadata/${prepared.master.metadataUri.split('/').at(-1)}`);
        assert.equal(metadata.status, 200);
        assert.match(metadata.headers.get('cache-control'), /immutable/);
        assert.equal((await fetch(`${base}/blockchain/masters/${f.id}`)).status, 401);
        assert.equal((await fetch(`${base}/blockchain/masters/${f.id}`, { headers: { authorization: `Bearer buyer-${f.id}` } })).status, 403);
        assert.equal((await fetch(`${base}/blockchain/masters/${f.id}`, { headers: { authorization: `Bearer seller-${f.id + 999}` } })).status, 404);
        const disabled = masterMintService(db, { ...options, gateway: undefined });
        await assert.rejects(disabled.prepare(f.id, f.id, 'Bearer seller-test'), /unavailable/);
    } finally { await new Promise(resolve => app.close(resolve)); }
});
