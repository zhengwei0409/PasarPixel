const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign, randomBytes } = require('node:crypto');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const bs58 = require('bs58').default;
const { PrismaClient } = require('../generated/client');
const { createApp } = require('../dist/app');

// An explicit local test URL is required. Each run migrates and later removes
// only its own randomly named schema; never reset or clear a project database.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a local disposable PostgreSQL database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Integration tests require a local database');
const schema = `wallet_test_${randomBytes(8).toString('hex')}`;
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
let auth, server, base;
let nextUser = 100;
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => server ? new Promise(resolve => server.close(resolve)) : Promise.resolve();
function wallet() {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    return {
        address: bs58.encode(publicKey.export({ type: 'spki', format: 'der' }).subarray(-32)),
        sign: message => sign(null, Buffer.from(message), privateKey).toString('base64'),
    };
}
async function request(userId, path = '/wallet', body) {
    const response = await fetch(`${base}/blockchain${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(userId ? { authorization: `Bearer user-${userId}` } : {}), 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
}
const challenge = (userId, key) => request(userId, '/wallet/challenge', { address: key.address });
const verify = (userId, key, issued) => request(userId, '/wallet/verify', {
    challengeId: issued.data.challengeId, signature: key.sign(issued.data.message),
});
async function bind(userId, key = wallet()) {
    const issued = await challenge(userId, key);
    assert.equal(issued.status, 201);
    const bound = await verify(userId, key, issued);
    assert.equal(bound.status, 200, JSON.stringify(bound.data));
    return { key, issued, bound };
}

before(async () => {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
        cwd: require('node:path').join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    auth = createServer((req, res) => {
        res.setHeader('content-type', 'application/json');
        const match = /^Bearer user-(\d+)$/.exec(req.headers.authorization ?? '');
        if (!match) { res.writeHead(401).end('{}'); return; }
        res.end(JSON.stringify({ userId: Number(match[1]), email: 'test@example.com', roles: ['BUYER'] }));
    });
    await listen(auth);
    server = createServer(createApp(db, `http://127.0.0.1:${auth.address().port}`, 'http://localhost:5173'));
    await listen(server);
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    await Promise.all([close(server), close(auth)]);
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
});

test('database health is public; wallet operations require a valid authenticated account', async () => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    assert.equal((await request(null)).status, 401);
    const initial = await request(nextUser++);
    assert.equal(initial.data.wallet, null);
    assert.equal(initial.data.canChange, true);
    assert.equal(initial.headers.get('cache-control'), 'no-store');
});

test('valid signatures bind; replay and cross-account challenge use are rejected', async () => {
    const userId = nextUser++;
    const key = wallet();
    const issued = await challenge(userId, key);
    assert.equal((await verify(nextUser++, key, issued)).status, 400);
    assert.equal((await verify(userId, wallet(), issued)).status, 400);
    assert.equal((await verify(userId, key, issued)).status, 200);
    assert.equal((await verify(userId, key, issued)).status, 400);
    assert.equal((await request(userId)).data.wallet.address, key.address);
    assert.equal(await db.wallet.count({ where: { userId } }), 1);
});

test('expired and superseded challenges are rejected', async () => {
    const userId = nextUser++;
    const key = wallet();
    const expired = await challenge(userId, key);
    await db.walletChallenge.update({ where: { userId }, data: { expiresAt: new Date(0) } });
    assert.equal((await verify(userId, key, expired)).status, 400);
    const old = await challenge(userId, key);
    const current = await challenge(userId, key);
    assert.equal((await verify(userId, key, old)).status, 400);
    assert.equal((await verify(userId, key, current)).status, 200);
});

test('one wallet cannot bind to two accounts, including a concurrent verification race', async () => {
    const key = wallet();
    const users = [nextUser++, nextUser++];
    const issued = await Promise.all(users.map(user => challenge(user, key)));
    const results = await Promise.all(users.map((user, index) => verify(user, key, issued[index])));
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    assert.equal(await db.wallet.count({ where: { address: key.address } }), 1);
    const third = await challenge(nextUser++, key);
    assert.equal(third.status, 409);
});

test('concurrent replay creates one binding and consumes the challenge once', async () => {
    const userId = nextUser++;
    const key = wallet();
    const issued = await challenge(userId, key);
    const results = await Promise.all([verify(userId, key, issued), verify(userId, key, issued)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400]);
    assert.equal(await db.wallet.count({ where: { userId } }), 1);
});

test('an unused binding can change; NFT ownership blocks replacement, including after challenge issuance', async () => {
    const userId = nextUser++;
    const { key: original } = await bind(userId);
    const { key: replacement } = await bind(userId);
    assert.notEqual(original.address, replacement.address);
    const other = wallet();
    const issued = await challenge(userId, other);
    const record = await db.wallet.findUnique({ where: { userId } });
    await db.masterNft.create({ data: { ownerWalletId: record.id, assetId: userId, status: "READY", assetAddress: wallet().address, metadataUri: 'https://example.com/master.json' } });
    assert.equal((await verify(userId, other, issued)).status, 409);
    const status = await request(userId);
    assert.equal(status.data.canChange, false);
    assert.equal(status.data.lockedReason, 'NFT_OWNERSHIP');
    assert.equal((await challenge(userId, other)).status, 409);
    assert.equal((await challenge(userId, replacement)).status, 201);
});

test('buyer license ownership and seller/buyer pending transactions prevent replacement', async () => {
    const sellerId = nextUser++;
    const buyerId = nextUser++;
    await bind(sellerId);
    await bind(buyerId);
    const seller = await db.wallet.findUnique({ where: { userId: sellerId } });
    const buyer = await db.wallet.findUnique({ where: { userId: buyerId } });
    const master = await db.masterNft.create({ data: { ownerWalletId: seller.id, assetId: sellerId, status: "READY", assetAddress: wallet().address, metadataUri: 'https://example.com/master.json' } });
    const license = await db.licenseNft.create({ data: { masterNftId: master.id, holderWalletId: buyer.id, orderItemId: buyerId, mintAddress: wallet().address, metadataUri: 'https://example.com/license.json', licenseType: 'PERSONAL' } });
    assert.equal((await request(buyerId)).data.lockedReason, 'NFT_OWNERSHIP');
    const pendingId = nextUser++;
    await bind(pendingId);
    const pendingWallet = await db.wallet.findUnique({ where: { userId: pendingId } });
    const tx = await db.blockchainTransaction.create({ data: { licenseNftId: license.id, sellerWalletId: pendingWallet.id, buyerWalletId: buyer.id, txSignature: 'test-signature' } });
    assert.equal((await request(pendingId)).data.lockedReason, 'PENDING_TRANSACTION');
    assert.equal((await challenge(pendingId, wallet())).status, 409);
    await db.blockchainTransaction.update({ where: { id: tx.id }, data: { sellerWalletId: seller.id, buyerWalletId: pendingWallet.id } });
    assert.equal((await request(pendingId)).data.lockedReason, 'PENDING_TRANSACTION');
    await db.blockchainTransaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
    assert.equal((await request(pendingId)).data.canChange, true);
});

test('malformed inputs are rejected and repeated challenge requests are rate limited', async () => {
    const userId = nextUser++;
    assert.equal((await request(userId, '/wallet/challenge', { address: {} })).status, 400);
    assert.equal((await request(userId, '/wallet/verify', { challengeId: [], signature: [] })).status, 400);
    const key = wallet();
    for (let i = 0; i < 8; i++) assert.equal((await challenge(userId, key)).status, 201);
    assert.equal((await challenge(userId, key)).status, 429);
    assert.equal((await challenge(nextUser++, wallet())).status, 201);
});

test('auth-service outages return a retryable error without accessing wallet data', async () => {
    const unavailable = createServer(createApp(db, 'http://127.0.0.1:1', 'http://localhost:5173'));
    await listen(unavailable);
    try {
        const response = await fetch(`http://127.0.0.1:${unavailable.address().port}/blockchain/wallet`, { headers: { authorization: 'Bearer user-1' } });
        assert.equal(response.status, 503);
    } finally { await close(unavailable); }
});
