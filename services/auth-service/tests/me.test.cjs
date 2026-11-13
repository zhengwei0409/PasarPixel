const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const jwt = require('jsonwebtoken');
const compiled = ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/auth.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

const currentUser = { id: 7, email: 'current@example.com', sessionVersion: 0, roles: [{ role: { name: 'BUYER' } }] };

async function me(payload, user = currentUser, unavailable = false) {
    let lookups = 0;
    const exports = {};
    runInNewContext(compiled, {
        exports, process: { env: { JWT_SECRET: 'test-only-secret' } },
        require: name => {
            if (name === 'jsonwebtoken') return jwt;
            if (name === '../../../../shared/types/adminAccount') return { ACCOUNT_SUSPENDED_CODE: 'ACCOUNT_SUSPENDED' };
            if (name === '../lib/prisma') return { prisma: { user: { findUnique: async () => { lookups++; if (unavailable) throw new Error('Offline'); return user; } } } };
            return {};
        },
    });
    const response = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.data = JSON.parse(JSON.stringify(data)); return this; },
    };
    await exports.me({ headers: { authorization: `Bearer ${jwt.sign(payload, 'test-only-secret', { expiresIn: '5m' })}` } }, response);
    return { ...response, lookups };
}

test('/auth/me rejects 2FA and other purpose tokens before querying the user', async () => {
    for (const payload of [{ sub: 7, purpose: '2fa' }, { sub: 7, purpose: 'reset' }, { sub: 7, purpose: null }, { sub: '7' }, { sub: -1 }]) {
        const result = await me(payload);
        assert.equal(result.statusCode, 401);
        assert.equal(result.lookups, 0);
    }
});

test('/auth/me rejects deleted accounts even if their access token has not expired', async () => {
    assert.equal((await me({ sub: 7 }, null)).statusCode, 401);
});

test('/auth/me rejects suspended accounts and keeps pre-suspension access tokens invalid after restoration', async () => {
    const suspended = await me({ sub: 7, sessionVersion: 1 }, { ...currentUser, sessionVersion: 1, suspendedAt: new Date() });
    assert.equal(suspended.statusCode, 401);
    assert.equal(suspended.data.code, 'ACCOUNT_SUSPENDED');
    const restored = { ...currentUser, sessionVersion: 1 };
    assert.equal((await me({ sub: 7 }, restored)).statusCode, 401);
    assert.equal((await me({ sub: 7, sessionVersion: 1 }, restored)).statusCode, 200);
});

test('/auth/me returns current roles and email instead of stale token claims', async () => {
    const result = await me({ sub: 7, email: 'old@example.com', roles: ['SELLER'] });
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.data, { userId: 7, email: 'current@example.com', roles: ['BUYER'] });
});

test('/auth/me reports a database outage as retryable instead of invalidating the session', async () => {
    assert.equal((await me({ sub: 7 }, undefined, true)).statusCode, 503);
});

test('admin account listing uses current permissions and only reports an ongoing enabled 2FA lockout', async () => {
    const exports = {};
    let canAdmin = false;
    let reads = 0;
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const account = (id, isEnabled, lockedUntil) => ({
        id, email: `user${id}@example.com`, createdAt,
        roles: [{ role: { name: 'SELLER' } }, { role: { name: 'BUYER' } }],
        twoFactorAuth: { isEnabled, lockedUntil, secret: 'private' },
    });
    const future = new Date(Date.now() + 60_000);
    const prisma = {
        userRole: { findFirst: async ({ where }) => {
            assert.equal(where.userId, 7);
            assert.equal(where.role.name, 'ADMIN');
            return canAdmin ? { userId: 7 } : null;
        } },
        user: { findMany: async () => {
            reads++;
            return [
                account(1, true, future), account(2, true, createdAt), account(3, false, future),
                { ...account(4, true, future), suspendedAt: createdAt },
            ];
        } },
    };
    runInNewContext(compiled, { exports, require: (name) => name === '../lib/prisma' ? { prisma } : {} });
    async function list() {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            set() { return this; },
            json(body) { this.body = JSON.parse(JSON.stringify(body)); },
        };
        await exports.listAdminAccounts({ userId: 7 }, res);
        return res;
    }
    assert.equal((await list()).statusCode, 403);
    assert.equal(reads, 0);
    canAdmin = true;
    const result = await list();
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.map(({ status }) => status), ['TWO_FACTOR_LOCKED', 'ACTIVE', 'ACTIVE', 'SUSPENDED']);
    assert.deepEqual(result.body[0], {
        userId: 1, email: 'user1@example.com', createdAt: createdAt.toISOString(),
        roles: ['BUYER', 'SELLER'], status: 'TWO_FACTOR_LOCKED',
    });
});

test('moderation requires an admin and a reason, records one decision per transition, and preserves a 2FA lock', async () => {
    const exports = {};
    const target = {
        id: 8, email: 'target@example.com', createdAt: new Date(), suspendedAt: null, sessionVersion: 0,
        roles: [{ role: { name: 'BUYER' } }],
        twoFactorAuth: { isEnabled: true, lockedUntil: new Date(Date.now() + 60_000) },
    };
    const decisions = [];
    let isAdmin = false;
    let transactionActive = false;
    const prisma = {
        userRole: { findFirst: async () => isAdmin ? { userId: 7 } : null },
        $transaction: async (callback) => {
            transactionActive = true;
            try { return await callback(prisma); } finally { transactionActive = false; }
        },
        user: {
            updateMany: async ({ where, data }) => {
                assert.equal(transactionActive, true);
                if (where.id !== target.id || (where.suspendedAt === null) !== (target.suspendedAt === null)) return { count: 0 };
                const excludedRole = where.roles?.none?.role?.name;
                if (target.roles.some(({ role }) => role.name === excludedRole)) return { count: 0 };
                target.suspendedAt = data.suspendedAt;
                target.sessionVersion += data.sessionVersion?.increment ?? 0;
                return { count: 1 };
            },
            findUnique: async ({ where }) => where.id === target.id ? target : null,
        },
        accountModeration: { create: async ({ data }) => {
            assert.equal(transactionActive, true);
            decisions.push(JSON.parse(JSON.stringify(data)));
        } },
    };
    runInNewContext(compiled, { exports, require: (name) => {
        if (name === '../lib/prisma') return { prisma };
        if (name === '../../../../shared/types/adminAccount') return { ACCOUNT_MODERATION_REASON_LIMIT: 500 };
        return {};
    } });
    async function update(suspended, reason, userId = '8') {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            set() { return this; },
            json(body) { this.body = body; },
        };
        await exports.updateAccountSuspension({ userId: 7, params: { userId }, body: { suspended, reason } }, res);
        return res;
    }

    assert.equal((await update(true, 'Policy violation')).statusCode, 403);
    isAdmin = true;
    assert.equal((await update(true, 'Policy violation', '7')).statusCode, 400);
    assert.equal((await update(true, 'Policy violation', '99')).statusCode, 404);
    assert.equal((await update('true', 'Policy violation')).statusCode, 400);
    assert.equal((await update(true, ' ')).statusCode, 400);
    assert.equal((await update(true, 'x'.repeat(501))).statusCode, 400);
    assert.equal(decisions.length, 0);

    target.roles.push({ role: { name: 'ADMIN' } });
    assert.equal((await update(true, 'Policy violation')).statusCode, 403);
    assert.equal(target.suspendedAt, null);
    assert.equal(target.sessionVersion, 0);
    target.roles.pop();
    assert.equal((await update(true, '  Policy violation  ')).body.status, 'SUSPENDED');
    assert.equal(target.sessionVersion, 1);
    const suspendedAt = target.suspendedAt;
    target.roles.push({ role: { name: 'ADMIN' } });
    assert.equal((await update(false, 'Appeal accepted')).statusCode, 403);
    assert.equal(target.suspendedAt, suspendedAt);
    assert.equal(decisions.length, 1);
    target.roles.pop();
    assert.equal((await update(true, 'Duplicate')).statusCode, 409);
    assert.equal((await update(false, ' ')).statusCode, 400);
    assert.equal((await update(false, '  Appeal accepted  ')).body.status, 'TWO_FACTOR_LOCKED');
    assert.equal(target.sessionVersion, 1);
    assert.deepEqual(decisions, [
        { userId: 8, adminId: 7, suspended: true, reason: 'Policy violation' },
        { userId: 8, adminId: 7, suspended: false, reason: 'Appeal accepted' },
    ]);
});
