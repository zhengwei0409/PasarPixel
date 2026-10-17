const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function loadUtility(file) {
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../src/lib', file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { exports, Buffer, process, require });
    return exports;
}
const downloadNames = loadUtility('nftDownloadName.ts');
const snapshotUtils = loadUtility('nftSnapshot.ts');

const plain = value => JSON.parse(JSON.stringify(value));
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/orders.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function response() {
    return {
        statusCode: 200,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = plain(body); return this; },
        setHeader(name, value) { this.headers[name] = value; },
        destroy(error) { throw error; },
    };
}

function fixture() {
    const state = {
        order: {
            id: 9, buyerId: 7, paymentStatus: 'COMPLETED', currency: 'MYR', totalAmount: '55.00',
            createdAt: new Date('2026-10-06T04:00:00Z'), buyer: { name: 'Buyer' },
            orderItems: [
                { id: 1, price: '25.00', licenseType: 'PERSONAL', asset: { id: 10, title: 'Model', files: [{ id: 101, fileUrl: 'models/model.glb' }] } },
                { id: 2, price: '30.00', licenseType: 'COMMERCIAL', asset: { id: 20, title: 'Image', files: [{ id: 201, fileUrl: 'images/image.png' }] } },
            ],
        },
        payload: { orderId: 9, userId: 7, itemId: 2 },
        entries: [],
    };
    const archive = {
        on() {}, pipe() {},
        append(stream, { name }) { state.entries.push({ key: stream.key, name }); },
        async finalize() { state.finalized = true; },
    };
    const exports = {};
    runInNewContext(compiled, {
        exports, console,
        require: name => {
            if (name === 'archiver') return () => archive;
            if (name === '../lib/prisma') return { prisma: { order: { findUnique: async () => state.order }, orderItem: { findUnique: async () => state.item }, assetMintSnapshot: { findUnique: async () => state.snapshot ?? null } } };
            if (name === '../lib/nftDownloadName') return downloadNames;
            if (name === '../lib/nftSnapshot') return snapshotUtils;
            if (name === '../lib/solEntitlement') return { solEntitlement: async () => state.accessFailure ?? null };
            if (name === '../lib/s3') return { extractKeyFromUrl: url => url, getObjectStream: async key => ({ key }) };
            if (name === '../lib/downloadToken') return {
                signDownloadToken: args => { state.signed = plain(args); return 'signed-token'; },
                verifyDownloadToken: () => state.payload,
            };
            if (name === '../lib/certificate') return { buildCertificate: () => { throw new Error('Unexpected certificate request'); } };
            if (name === '../lib/receipt') return { buildReceipt: data => {
                state.receipt = plain(data);
                return { pipe: res => { state.pipedTo = res; } };
            } };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return { handlers: exports, state };
}

const request = (query = {}, userId = 7) => ({ user: { userId }, params: { id: '9' }, query });

test('SOL ZIP downloads the purchased immutable originals even after listing files change', async () => {
    const { handlers, state } = fixture();
    state.order.paymentMethod = 'SOL';
    state.order.orderItems[1].originalSnapshot = [{ key: `nft-originals/${'a'.repeat(64)}`, name: 'purchased.png' }];
    state.order.orderItems[1].asset.files = [{ fileUrl: 'new-listing-file.png' }];
    await handlers.downloadOrderZip(request({ token: 'signed-token' }), response());
    assert.deepEqual(state.entries, [{ key: `nft-originals/${'a'.repeat(64)}`, name: '20-Image/purchased.png' }]);
});

test('legacy NFT snapshots recover pic2.jpg by the immutable file reference and still stream the private snapshot', async () => {
    const { handlers, state } = fixture(); state.order.paymentMethod = 'SOL';
    state.snapshot = { listingRef: 'legacy-listing', manifestHash: 'b'.repeat(64) };
    const item = state.order.orderItems[1]; item.manifestHash = state.snapshot.manifestHash;
    item.originalSnapshot = [{ key: `nft-originals/${'a'.repeat(64)}`, reference: snapshotUtils.sha256('legacy-listing:201'), fileType: 'image/jpeg' }];
    item.asset.files = [{ id: 201, purpose: 'ORIGINAL', fileUrl: 'images/1792227247493-pic2.jpg' }];
    await handlers.downloadOrderZip(request({ token: 'signed-token' }), response());
    assert.deepEqual(state.entries, [{ key: `nft-originals/${'a'.repeat(64)}`, name: '20-Image/pic2.jpg' }]);
    assert.equal(item.originalSnapshot[0].name, undefined);
});

test('unmatched or missing legacy file metadata falls back to a filename with the snapshotted type extension', async () => {
    for (const matchingManifest of [true, false]) {
        const { handlers, state } = fixture(); state.order.paymentMethod = 'SOL';
        state.snapshot = { listingRef: 'legacy-listing', manifestHash: 'b'.repeat(64) };
        const item = state.order.orderItems[1]; item.manifestHash = matchingManifest ? state.snapshot.manifestHash : 'c'.repeat(64);
        item.originalSnapshot = [{ key: `nft-originals/${'a'.repeat(64)}`, reference: snapshotUtils.sha256('legacy-listing:201'), fileType: 'image/jpeg' }];
        item.asset.files = [{ id: matchingManifest ? 202 : 201, purpose: 'ORIGINAL', fileUrl: 'images/new-file.png' }];
        await handlers.downloadOrderZip(request({ token: 'signed-token' }), response());
        assert.equal(state.entries[0].name, '20-Image/original-1.jpg');
        assert.equal(state.entries[0].key, `nft-originals/${'a'.repeat(64)}`);
    }
});

test('revoked SOL access blocks both new download tokens and redemption of an existing token', async () => {
    const { handlers, state } = fixture();
    state.order.paymentMethod = 'SOL'; state.accessFailure = { status: 403, error: 'Access revoked', purchaseVerified: true };
    for (const [operation, query] of [[handlers.getDownloadUrl, {}], [handlers.downloadOrderZip, { token: 'signed-token' }]]) {
        const res = response(); await operation(request(query), res); assert.equal(res.statusCode, 403);
    }
    assert.equal(state.signed, undefined); assert.equal(state.entries.length, 0);
});

test('public SOL verification distinguishes a valid historical purchase from current access and unverifiable proof', async () => {
    for (const [failure, expectedStatus, valid, currentAccess] of [[null, 200, true, true], [{ status: 403, purchaseVerified: true }, 200, true, false], [{ status: 403, purchaseVerified: false }, 404, false, undefined], [{ status: 503, error: 'RPC offline' }, 503, undefined, undefined]]) {
        const { handlers, state } = fixture(); state.accessFailure = failure;
        state.item = { licenseKey: 'key', licenseType: 'PERSONAL', order: { paymentMethod: 'SOL', paymentStatus: 'COMPLETED', buyerId: 7 }, asset: { title: 'Asset', seller: { name: 'Seller' } } };
        const res = response(); await handlers.verifyLicense({ params: { licenseKey: 'key' } }, res);
        assert.equal(res.statusCode, expectedStatus); assert.equal(res.body.valid, valid); assert.equal(res.body.currentAccess, currentAccess);
        assert.equal(res.body.buyerId, undefined);
    }
});

test('item download URL signs the selected item into the token', async () => {
    const { handlers, state } = fixture();
    const res = response();
    await handlers.getDownloadUrl(request({ itemId: '2' }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(state.signed, { orderId: 9, userId: 7, itemId: 2 });
});

test('download URLs reject invalid items, unpaid orders, and other buyers', async () => {
    for (const [itemId, userId, paymentStatus, expected] of [
        ['999', 7, 'COMPLETED', 404], ['0', 7, 'COMPLETED', 400],
        ['1.5', 7, 'COMPLETED', 400], ['2', 8, 'COMPLETED', 404],
        ['2', 7, 'PENDING', 403], ['2', 7, 'REFUNDED', 403],
    ]) {
        const { handlers, state } = fixture();
        state.order.paymentStatus = paymentStatus;
        const res = response();
        await handlers.getDownloadUrl(request({ itemId }, userId), res);
        assert.equal(res.statusCode, expected);
        assert.equal(state.signed, undefined);
    }
});

test('item ZIP includes only the item in the signed token, ignoring query overrides', async () => {
    const { handlers, state } = fixture();
    const res = response();
    await handlers.downloadOrderZip(request({ token: 'signed-token', itemId: '1' }), res);
    assert.deepEqual(state.entries, [{ key: 'images/image.png', name: '20-Image/image.png' }]);
    assert.equal(state.finalized, true);
});

test('existing full-order tokens continue downloading all assets', async () => {
    const { handlers, state } = fixture();
    delete state.payload.itemId;
    await handlers.downloadOrderZip(request({ token: 'signed-token' }), response());
    assert.equal(state.entries.length, 2);
});

test('ZIP download rechecks payment and ownership', async () => {
    for (const [buyerId, paymentStatus] of [[8, 'COMPLETED'], [7, 'REFUNDED']]) {
        const { handlers, state } = fixture();
        state.order.buyerId = buyerId;
        state.order.paymentStatus = paymentStatus;
        const res = response();
        await handlers.downloadOrderZip(request({ token: 'signed-token' }), res);
        assert.equal(res.statusCode, 404);
        assert.equal(state.entries.length, 0);
    }
});

test('receipt PDF uses the stored order currency, prices, and buyer', async () => {
    const { handlers, state } = fixture();
    const res = response();
    await handlers.getReceipt(request(), res);
    assert.equal(res.headers['Content-Type'], 'application/pdf');
    assert.equal(state.receipt.orderId, 9);
    assert.equal(state.receipt.currency, 'MYR');
    assert.equal(state.receipt.totalAmount, 55);
    assert.equal(state.receipt.buyerName, 'Buyer');
    assert.deepEqual(state.receipt.items, [
        { title: 'Model', licenseType: 'PERSONAL', price: 25 },
        { title: 'Image', licenseType: 'COMMERCIAL', price: 30 },
    ]);
    assert.equal(state.pipedTo, res);
});

test('receipt is unavailable to other buyers and for unpaid or refunded orders', async () => {
    for (const [userId, paymentStatus] of [[8, 'COMPLETED'], [7, 'PENDING'], [7, 'REFUNDED']]) {
        const { handlers, state } = fixture();
        state.order.paymentStatus = paymentStatus;
        const res = response();
        await handlers.getReceipt(request({}, userId), res);
        assert.equal(res.statusCode, 404);
        assert.equal(state.receipt, undefined);
    }
});

test('download token protects item scope from tampering and preserves full-order tokens', () => {
    const tokenCode = ts.transpileModule(readFileSync(join(__dirname, '../src/lib/downloadToken.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exports = {};
    runInNewContext(tokenCode, {
        exports, Buffer,
        process: { env: { DOWNLOAD_TOKEN_SECRET: 'test-download-secret' } },
        require: name => {
            if (name === 'crypto') return require('node:crypto');
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    const scoped = exports.signDownloadToken({ orderId: 9, userId: 7, itemId: 2 });
    assert.equal(exports.verifyDownloadToken(scoped).itemId, 2);
    const [body, signature] = scoped.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    delete payload.itemId;
    const tampered = `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${signature}`;
    assert.equal(exports.verifyDownloadToken(tampered), null);
    const fullOrder = exports.signDownloadToken({ orderId: 9, userId: 7 });
    assert.equal(exports.verifyDownloadToken(fullOrder).itemId, undefined);
});
