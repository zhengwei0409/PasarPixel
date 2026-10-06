const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

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
            if (name === '../lib/prisma') return { prisma: { order: { findUnique: async () => state.order } } };
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
