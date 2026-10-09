const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const plain = value => JSON.parse(JSON.stringify(value));
function controller(file, prisma) {
    const compiled = ts.transpileModule(readFileSync(join(__dirname, `../src/controllers/${file}.controller.ts`), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    runInNewContext(compiled, { exports, require: name => {
        if (name === '../lib/prisma') return { prisma };
        if (name === '../lib/publisher') return { publishReviewReceived: async () => {}, publishAssetRemoved: async () => {} };
        throw new Error(`Unexpected dependency ${name}`);
    }});
    return exports;
}
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = plain(body); return this; } }; }
const request = (body = {}, userId = 7, roles = ['BUYER']) => ({ user: { userId, roles }, params: { id: '10', reviewId: '25' }, body });
test('unpaid users cannot leave ratings or comments', async () => {
    let written = false;
    const handlers = controller('review', {
        asset: { findFirst: async () => ({ sellerId: 3 }) },
        order: { findFirst: async args => { assert.equal(args.where.paymentStatus, 'COMPLETED'); return null; } },
        review: { upsert: async () => { written = true; } },
    });
    const res = response();
    await handlers.upsertReview(request({ rating: 5, comment: 'Nice' }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(written, false);
});
test('verified buyers can create or edit their own review', async () => {
    let saved;
    const handlers = controller('review', {
        asset: { findFirst: async () => ({ sellerId: 3, title: 'Asset' }) },
        order: { findFirst: async () => ({ id: 9 }) },
        review: { findUnique: async () => ({ id: 25 }), upsert: async args => { saved = plain(args); return { id: 25, ...args.update }; } },
    });
    const res = response();
    await handlers.upsertReview(request({ rating: 4, comment: '  Good  ' }), res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(saved.where, { userId_assetId: { userId: 7, assetId: 10 } });
    assert.deepEqual(saved.update, { rating: 4, comment: 'Good' });
});
test('seller cannot review their own asset', async () => {
    const res = response();
    await controller('review', { asset: { findFirst: async () => ({ sellerId: 7 }) } }).upsertReview(request({ rating: 5 }), res);
    assert.equal(res.statusCode, 403);
});
test('eligibility allows only completed purchasers', async () => {
    for (const purchased of [true, false]) {
        const res = response();
        await controller('review', { asset: { findFirst: async () => ({ sellerId: 3 }) }, order: { findFirst: async () => purchased ? { id: 1 } : null } }).getReviewEligibility(request(), res);
        assert.equal(res.body.canReview, purchased);
    }
});
test('another user cannot reply to an asset review', async () => {
    const res = response();
    await controller('review', { review: { findFirst: async () => ({ asset: { sellerId: 3 } }) } }).upsertSellerReply(request({ reply: 'Hello' }), res);
    assert.equal(res.statusCode, 403);
});
test('asset seller edits the single existing reply', async () => {
    let saved;
    const res = response();
    await controller('review', { review: {
        findFirst: async args => { assert.deepEqual(plain(args.where), { id: 25, assetId: 10 }); return { asset: { sellerId: 7 }, sellerReply: 'Old' }; },
        update: async args => { saved = plain(args); return { id: 25, sellerReply: args.data.sellerReply }; },
    }}).upsertSellerReply(request({ reply: '  Thanks!  ' }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(saved.where.id, 25);
    assert.equal(saved.data.sellerReply, 'Thanks!');
    assert.ok(saved.data.sellerReplyUpdatedAt);
});
test('reply rejects missing reviews and invalid or oversized text', async () => {
    for (const reply of ['', '  ', 3, 'x'.repeat(2001)]) {
        const res = response();
        await controller('review', {}).upsertSellerReply(request({ reply }), res);
        assert.equal(res.statusCode, 400);
    }
    const res = response();
    await controller('review', { review: { findFirst: async () => null } }).upsertSellerReply(request({ reply: 'Thanks' }), res);
    assert.equal(res.statusCode, 404);
});
test('non-admin buyers and sellers can report without a purchase, including the owner', async () => {
    for (const [userId, roles] of [[7, ['BUYER']], [3, ['SELLER']]]) {
        const res = response();
        await controller('report', { asset: { findFirst: async () => ({ sellerId: 3 }) }, report: { create: async args => ({ id: 1, ...args.data }) } }).createReport(request({ assetId: 10, reason: 'Copyright' }, userId, roles), res);
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.userId, userId);
    }
});
test('admins cannot report assets, even when they also have buyer or seller roles', async () => {
    for (const roles of [['ADMIN'], ['BUYER', 'ADMIN'], ['SELLER', 'ADMIN']]) {
        const res = response();
        await controller('report', {}).createReport(request({ assetId: 10, reason: 'Spam' }, 7, roles), res);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.error, 'Admins cannot report assets.');
    }
});
test('duplicate report constraint returns a useful conflict', async () => {
    const res = response();
    await controller('report', { asset: { findFirst: async () => ({ sellerId: 3 }) }, report: { create: async () => { throw { code: 'P2002' }; } } }).createReport(request({ assetId: 10, reason: 'Spam' }), res);
    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /already reported/);
});
test('unexpected report database errors propagate', async () => {
    const handlers = controller('report', { asset: { findFirst: async () => ({ sellerId: 3 }) }, report: { create: async () => { throw new Error('DB unavailable'); } } });
    await assert.rejects(() => handlers.createReport(request({ assetId: 10, reason: 'Spam' }), response()), /DB unavailable/);
});
test('reports reject blank reasons and unavailable assets', async () => {
    let res = response();
    await controller('report', {}).createReport(request({ assetId: 10, reason: '  ' }), res);
    assert.equal(res.statusCode, 400);
    res = response();
    await controller('report', { asset: { findFirst: async () => null } }).createReport(request({ assetId: 10, reason: 'Spam' }), res);
    assert.equal(res.statusCode, 404);
});
