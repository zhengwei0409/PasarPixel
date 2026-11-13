const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { join } = require('node:path');
const { after, before, test } = require('node:test');
const express = require('express');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a local disposable PostgreSQL database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('A local test database is required');
const schema = `activity_log_test_${randomBytes(8).toString('hex')}`;
url.searchParams.set('schema', schema);
process.env.DATABASE_URL = url.toString();
process.env.TS_NODE_TRANSPILE_ONLY = 'true';
require('ts-node/register');

let auth, api, prisma;
const actorId = 970001;
const targetId = 970002;
const assetId = 970003;
const marker = `activity-log-${Date.now()}`;
const start = new Date('2031-04-03T00:00:00.000Z');
const end = new Date('2031-04-03T23:59:59.999Z');

async function listen(app) {
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return server;
}

before(async () => {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
        cwd: join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    const authApp = express();
    authApp.get('/auth/me', (req, res) => {
        const token = req.get('Authorization');
        if (!['Bearer admin', 'Bearer buyer'].includes(token)) return res.sendStatus(401);
        res.json({ userId: actorId, roles: [token === 'Bearer admin' ? 'ADMIN' : 'BUYER'] });
    });
    auth = await listen(authApp);
    process.env.AUTH_SERVICE_URL = `http://127.0.0.1:${auth.address().port}`;

    ({ prisma } = require('../src/lib/prisma.ts'));
    const app = express();
    app.use('/logs', require('../src/routes/log.routes.ts').default);
    api = await listen(app);

    await prisma.userProfile.create({ data: { userId: actorId, name: 'Lin, Mei', email: `${marker}@example.test` } });
    await prisma.roleChangeLog.createMany({ data: Array.from({ length: 27 }, (_, index) => ({
        adminUserId: actorId, targetUserId: targetId, role: 'SELLER', action: 'GRANT',
        reason: `${marker} ${index === 0 ? '100% match' : 'ordinary'}`,
        createdAt: index === 0 ? start : end,
    })) });
    await prisma.roleChangeLog.create({ data: {
        adminUserId: actorId, targetUserId: targetId, role: 'SELLER', action: 'REVOKE',
        reason: marker, createdAt: new Date('2031-04-04T00:00:00.000Z'),
    } });
    await prisma.assetReviewLog.create({ data: { adminUserId: actorId, assetId, action: 'REJECT', reason: `=1+1, "${marker} 林"`, createdAt: end } });
    await prisma.activityLog.create({ data: { userId: actorId, action: `DELETE_USER: ${marker}`, targetType: 'USER', targetId, createdAt: start } });
});

after(async () => {
    api?.close();
    auth?.close();
    if (!prisma) return;
    try {
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
        await prisma.$disconnect();
    }
});

function get(path = '', params = {}, token = 'admin') {
    return fetch(`http://127.0.0.1:${api.address().port}/logs/activity${path}?${new URLSearchParams(params)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
}

test('list and CSV require Admin authorization', async () => {
    for (const path of ['', '/export']) {
        assert.equal((await get(path, {}, '')).status, 401);
        assert.equal((await get(path, {}, 'buyer')).status, 403);
    }
});

test('combined filters are inclusive for UTC dates and export matches both result pages', async () => {
    const filters = { category: 'ROLE_CHANGE', search: marker.toUpperCase(), from: '2031-04-03', to: '2031-04-03' };
    const first = await (await get('', filters)).json();
    const second = await (await get('', { ...filters, page: 2 })).json();
    assert.equal(first.items.length, 25);
    assert.equal(first.hasNextPage, true);
    assert.equal(second.items.length, 2);
    assert.equal(second.hasNextPage, false);
    assert.equal(second.items.at(-1).createdAt, start.toISOString());
    const ids = [...first.items, ...second.items].map((item) => item.id);
    assert.equal(new Set(ids).size, 27);

    const response = await get('/export', { ...filters, page: 2 });
    assert.match(response.headers.get('content-type'), /^text\/csv/);
    assert.match(response.headers.get('content-disposition'), /attachment;.*\.csv/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const lines = (await response.text()).split('\r\n');
    assert.deepEqual(lines.slice(1).map((line) => line.split(',')[0]), ids.map((id) => `"${id}"`));
});

test('search combines stored sources, treats % literally, and CSV protects reason cells', async () => {
    const { items } = await (await get('', { search: `${marker} 100%` })).json();
    assert.equal(items.length, 1);
    assert.equal(items[0].targetLabel, `User #${targetId}`);
    const other = await (await get('', { category: 'OTHER', search: marker })).json();
    assert.equal(other.items[0].action, 'User deleted');
    assert.equal(other.items[0].reason, marker);
    const csv = await (await get('/export', { category: 'ASSET_REVIEW', search: marker })).text();
    assert.match(csv, /"Lin, Mei"/);
    assert.ok(csv.includes(`"'=1+1, ""${marker} 林"""`));
});

test('invalid dates, categories and pages return 400', async () => {
    for (const path of ['', '/export']) {
        assert.equal((await get(path, { from: '2031-02-29' })).status, 400);
        assert.equal((await get(path, { from: '2031-04-04', to: '2031-04-03' })).status, 400);
        assert.equal((await get(path, { category: 'constructor' })).status, 400);
    }
    assert.equal((await get('', { page: '0' })).status, 400);
});
