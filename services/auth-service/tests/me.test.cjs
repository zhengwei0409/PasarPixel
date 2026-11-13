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

async function me(payload, user = { id: 7, email: 'current@example.com', roles: [{ role: { name: 'BUYER' } }] }, unavailable = false) {
    let lookups = 0;
    const exports = {};
    runInNewContext(compiled, {
        exports, process: { env: { JWT_SECRET: 'test-only-secret' } },
        require: name => {
            if (name === 'jsonwebtoken') return jwt;
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
            return [account(1, true, future), account(2, true, createdAt), account(3, false, future)];
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
    assert.deepEqual(result.body.map(({ status }) => status), ['TWO_FACTOR_LOCKED', 'ACTIVE', 'ACTIVE']);
    assert.deepEqual(result.body[0], {
        userId: 1, email: 'user1@example.com', createdAt: createdAt.toISOString(),
        roles: ['BUYER', 'SELLER'], status: 'TWO_FACTOR_LOCKED',
    });
});
