const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function compile(path) {
    return ts.transpileModule(readFileSync(join(__dirname, path), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
}

const controller = compile('../src/controllers/adminUserDetail.controller.ts');
const routes = compile('../src/routes/user.routes.ts');
const recent = new Date('2026-11-12T10:00:00Z');
const earlier = new Date('2026-11-11T10:00:00Z');

function fixture({ authStatus, profileExists = true, rows, walletAddress = null, walletUnavailable = false } = {}) {
    const queries = [];
    const accounts = [];
    const walletRequests = [];
    const profile = {
        name: 'Avery Tan', avatarUrl: null, bio: 'Designer', phone: null,
        country: 'Malaysia', billingAddress: null, preferredCurrency: 'MYR',
        socialLinks: { portfolio: 'portfolio.example/work' }, updatedAt: recent,
    };
    const activityRows = rows ?? {
        order: [{ id: 6, createdAt: earlier }],
        asset: [{ id: 7, title: 'Studio light', status: 'PUBLISHED', createdAt: recent }],
    };
    const prisma = {
        userProfile: { findUnique: async (query) => {
            queries.push({ model: 'profile', where: query.where });
            return profileExists ? profile : null;
        } },
    };
    for (const model of ['order', 'asset', 'review', 'report', 'sellerApplication', 'roleChangeLog', 'activityLog']) {
        prisma[model] = {
            count: async ({ where }) => { queries.push({ model, where }); return activityRows[model]?.length ?? 0; },
            findMany: async ({ where, take }) => {
                queries.push({ model, where, take });
                return (activityRows[model] ?? []).slice(0, take);
            },
        };
    }
    const exports = {};
    runInNewContext(controller, {
        exports,
        process: { env: { AUTH_SERVICE_URL: 'http://auth-service:3001' } },
        require: (name) => {
            if (name === '../lib/prisma') return { prisma };
            if (name.endsWith('/socialLinks')) {
                const shared = {};
                runInNewContext(compile('../../../shared/utils/socialLinks.ts'), { exports: shared, URL });
                return shared;
            }
            assert.equal(name, 'axios');
            return {
                get: async (url, options) => {
                    if (url.startsWith('http://blockchain-service:3004/')) {
                        walletRequests.push({ url, auth: options.headers.authorization });
                        if (walletUnavailable) throw new Error('Wallet service unavailable');
                        return { data: { address: walletAddress } };
                    }
                    accounts.push({ url, auth: options.headers.authorization });
                    if (authStatus) throw { response: { status: authStatus } };
                    return { data: { userId: 42, email: 'avery@example.test', roles: ['BUYER', 'SELLER'], status: 'ACTIVE', twoFactorEnabled: true } };
                },
                isAxiosError: (error) => Boolean(error.response),
            };
        },
    });
    return {
        handler: exports.getAdminUserDetail,
        queries, accounts, walletRequests,
        async request(userId = '42', query = {}) {
            const response = {
                statusCode: 200,
                status(code) { this.statusCode = code; return this; },
                set() { return this; },
                json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
            };
            await exports.getAdminUserDetail({ params: { userId }, query, headers: { authorization: 'Bearer test' } }, response);
            return response;
        },
    };
}

test('the detail route requires authentication and the admin role', () => {
    const getRoutes = new Map();
    const authenticate = () => {};
    const adminGuard = () => {};
    const { handler } = fixture();
    const modules = {
        express: { Router: () => ({ get: (path, ...handlers) => getRoutes.set(path, handlers), delete() {} }) },
        '../middleware/auth.middleware': { authenticate, requireRole: (role) => { assert.equal(role, 'ADMIN'); return adminGuard; } },
        '../controllers/user.controller': {},
        '../controllers/adminUserDetail.controller': { getAdminUserDetail: handler },
    };
    runInNewContext(routes, { exports: {}, require: (name) => modules[name] });
    assert.deepEqual(getRoutes.get('/:userId'), [authenticate, adminGuard, handler]);
});

test('detail scopes marketplace queries to the selected account and combines its latest activity', async () => {
    const view = fixture();
    const result = await view.request();
    assert.equal(result.statusCode, 200);
    assert.deepEqual(view.accounts, [{ url: 'http://auth-service:3001/auth/admin/accounts/42', auth: 'Bearer test' }]);
    for (const { model, where, take } of view.queries) {
        const id = where.buyerId ?? where.sellerId ?? where.targetUserId ?? where.userId;
        assert.equal(id, 42, model);
        if (model === 'order') assert.equal(where.paymentStatus, 'COMPLETED');
        if (model === 'asset') assert.equal(where.isDeleted, false);
        if (take !== undefined) assert.equal(take, 8);
    }
    assert.deepEqual(result.body.profile.socialLinks, ['https://portfolio.example/work']);
    assert.deepEqual(result.body.activity.counts, { orders: 1, listings: 1, reviews: 0, reports: 0 });
    assert.deepEqual(result.body.activity.recent.map(({ kind }) => kind), ['listing', 'order']);
    assert.equal(result.body.activity.page, 1);
    assert.equal(result.body.activity.totalPages, 1);
});

test('activity pages merge sources, preserve timestamp ties, and return older records after the first eight', async () => {
    const rows = {
        order: Array.from({ length: 9 }, (_, i) => ({ id: 12 - i, createdAt: recent })),
        roleChangeLog: [{ id: 7, role: 'SELLER', action: 'GRANT', createdAt: earlier }],
    };
    const view = fixture({ rows });
    const first = (await view.request()).body.activity;
    const second = (await view.request('42', { activityPage: '2' })).body.activity;
    assert.deepEqual(first.recent.map(({ id }) => id), ['order-12', 'order-11', 'order-10', 'order-9', 'order-8', 'order-7', 'order-6', 'order-5']);
    assert.deepEqual(second.recent.map(({ id }) => id), ['order-4', 'role-7']);
    assert.equal(first.totalPages, 2);
    assert.equal(second.page, 2);
    assert.deepEqual((await view.request('42', { activityPage: '99' })).body.activity, second);
    assert.equal((await view.request('42', { activityPage: '0' })).statusCode, 400);
});

test('a missing profile still returns account details and invalid or unavailable accounts do not query profiles', async () => {
    const missingProfile = await fixture({ profileExists: false }).request();
    assert.equal(missingProfile.body.account.userId, 42);
    assert.equal(missingProfile.body.profile, null);

    const invalidId = fixture();
    assert.equal((await invalidId.request('2147483648')).statusCode, 400);
    assert.equal(invalidId.accounts.length, 0);
    for (const [upstream, response] of [[404, 404], [403, 403], [500, 503]]) {
        const view = fixture({ authStatus: upstream });
        assert.equal((await view.request()).statusCode, response);
        assert.equal(view.queries.length, 0);
        assert.equal(view.walletRequests.length, 0);
    }
});

test('wallet binding comes from the selected account in Blockchain Service, even without a profile', async () => {
    const address = '11111111111111111111111111111111';
    const view = fixture({ profileExists: false, walletAddress: address });
    const linked = await view.request();
    assert.deepEqual(view.walletRequests, [{ url: 'http://blockchain-service:3004/blockchain/admin/wallets/42', auth: 'Bearer test' }]);
    assert.equal(linked.body.profile, null);
    assert.deepEqual(linked.body.wallet, { status: 'linked', address });
    assert.deepEqual((await fixture().request()).body.wallet, { status: 'unlinked' });
    const unavailable = await fixture({ walletUnavailable: true }).request();
    assert.equal(unavailable.statusCode, 200);
    assert.deepEqual(unavailable.body.wallet, { status: 'unavailable' });
    assert.equal(unavailable.body.profile.name, 'Avery Tan');
});
