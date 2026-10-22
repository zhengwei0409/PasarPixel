const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/adminAssets.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function list(query) {
    const queries = {};
    const exports = {};
    const prisma = { asset: {
        findMany: async (args) => { queries.items = args; return [{ id: 1, status: 'DRAFT' }]; },
        count: async (args) => { queries.count = args; return 21; },
    } };
    runInNewContext(source, { exports, require: (name) => name === '../lib/prisma' ? { prisma } : { AssetStatus: Object.fromEntries(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'TAKEN_DOWN'].map((status) => [status, status])) } });
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; } };
    await exports.listAdminAssets({ query }, res);
    return JSON.parse(JSON.stringify({ queries, body: res.body, status: res.statusCode }));
}

test('all-status inventory is paginated, excludes deleted assets, and omits private file data', async () => {
    const { queries, body } = await list({ page: '2' });
    assert.deepEqual(queries.items.where, { isDeleted: false });
    assert.deepEqual(queries.count.where, queries.items.where);
    assert.equal(queries.items.skip, 20);
    assert.equal(queries.items.take, 20);
    assert.deepEqual(queries.items.orderBy, [{ updatedAt: 'desc' }, { id: 'desc' }]);
    assert.equal(queries.items.select.files, undefined);
    assert.deepEqual(queries.items.select.seller, { select: { userId: true, name: true } });
    assert.equal(body.total, 21);
    assert.equal(body.page, 2);
});

test('inventory accepts every lifecycle status and searches titles and seller names', async () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'TAKEN_DOWN']) {
        const { queries } = await list({ status, search: ' forest ' });
        assert.equal(queries.items.where.status, status);
        assert.deepEqual(queries.items.where.OR, [{ title: { contains: 'forest', mode: 'insensitive' } }, { seller: { name: { contains: 'forest', mode: 'insensitive' } } }]);
        assert.deepEqual(queries.count.where, queries.items.where);
    }
});

test('invalid filters are rejected before querying the database', async () => {
    for (const query of [{ page: '-1' }, { page: '1.5' }, { page: 'abc' }, { page: '1000001' }, { status: 'INVALID' }, { status: ['DRAFT'] }, { search: {} }, { search: 'x'.repeat(201) }]) {
        const result = await list(query);
        assert.equal(result.status, 400);
        assert.deepEqual(result.queries, {});
    }
});

test('inventory endpoint requires authentication and the admin role', () => {
    const routes = readFileSync(join(__dirname, '../src/routes/dashboard.routes.ts'), 'utf8');
    assert.match(routes, /router.get\("\/assets", authenticate, requireRole\("ADMIN"\), listAdminAssets\)/);
});

async function takedown({ reason = '  Copyright violation  ', id = '7', asset = { id: 7, sellerId: 3, title: 'Drone', status: 'PUBLISHED', isDeleted: false }, count = 1 } = {}) {
    const exports = {};
    const calls = { notifications: [] };
    const prisma = { asset: {
        findUnique: async (query) => { calls.lookup = query; return asset; },
        updateMany: async (query) => { calls.update = query; return { count }; },
    } };
    runInNewContext(source, { exports, require: (name) => {
        if (name === '../lib/prisma') return { prisma };
        if (name === '../lib/publisher') return { publishAssetRemoved: async (event) => { calls.notifications.push(event); } };
        return {};
    } });
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; } };
    await exports.takeDownAdminAsset({ params: { id }, body: { reason } }, res);
    return JSON.parse(JSON.stringify({ calls, body: res.body, status: res.statusCode }));
}

test('takedown saves the trimmed reason, retains the admin record, and notifies the seller', async () => {
    const { calls, body, status } = await takedown();
    assert.equal(status, 200);
    assert.deepEqual(calls.update, { where: { id: 7, status: 'PUBLISHED', isDeleted: false }, data: { status: 'TAKEN_DOWN', rejectionReason: 'Copyright violation' } });
    assert.deepEqual(calls.notifications, [{ sellerId: 3, assetId: 7, assetTitle: 'Drone', reason: 'Copyright violation' }]);
    assert.equal(body.status, 'TAKEN_DOWN');
});

test('takedown rejects blank or oversized reasons and invalid IDs before accessing assets', async () => {
    for (const input of [{ reason: '' }, { reason: '  ' }, { reason: null }, { reason: 123 }, { reason: 'x'.repeat(2001) }, { id: 'abc' }, { id: '0' }, { id: '7.1' }]) {
        const { calls, status } = await takedown(input);
        assert.equal(status, 400);
        assert.equal(calls.lookup, undefined);
        assert.equal(calls.update, undefined);
        assert.deepEqual(calls.notifications, []);
    }
});

test('missing, deleted, and non-published assets cannot be taken down', async () => {
    for (const asset of [null, { isDeleted: true }, ...['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'TAKEN_DOWN'].map((status) => ({ status, isDeleted: false }))]) {
        const result = await takedown({ asset });
        assert.equal(result.status, !asset || asset.isDeleted ? 404 : 409);
        assert.equal(result.calls.update, undefined);
        assert.deepEqual(result.calls.notifications, []);
    }
});

test('a concurrent status change prevents a duplicate takedown and notification', async () => {
    const { calls, status } = await takedown({ count: 0 });
    assert.equal(status, 409);
    assert.deepEqual(calls.notifications, []);
});

test('takedown endpoint requires authentication and the admin role', () => {
    const routes = readFileSync(join(__dirname, '../src/routes/dashboard.routes.ts'), 'utf8');
    assert.match(routes, /router.patch\("\/assets\/:id\/take-down", authenticate, requireRole\("ADMIN"\), takeDownAdminAsset\)/);
});
