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
