const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(path, modules = {}) {
    const exports = {};
    const code = ts.transpileModule(readFileSync(join(__dirname, path), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    runInNewContext(code, { exports, require: (name) => {
        assert.ok(name in modules, name);
        return modules[name];
    } });
    return exports;
}

const shared = load('../../../shared/types/adminTransaction.ts');
const time = new Date('2026-11-13T05:00:00Z');
const account = { userId: 7, name: 'Avery Tan', email: 'avery@example.test' };

function fixture() {
    const calls = [];
    const orders = [
        { id: 2, buyer: account, paymentStatus: 'COMPLETED', paymentMethod: 'SOL', totalAmount: 0.000000001,
            currency: 'USD', totalLamports: '1', stripePaymentId: null, blockchainSignature: 'signature', purchaseRef: 'ref',
            createdAt: time, updatedAt: time, _count: { orderItems: 1 } },
        { id: 1, buyer: account, paymentStatus: 'PENDING', paymentMethod: 'STRIPE', totalAmount: 24.9,
            currency: 'MYR', totalLamports: null, stripePaymentId: 'cs_test_example', blockchainSignature: null,
            purchaseRef: null, createdAt: time, updatedAt: time, _count: { orderItems: 2 } },
    ];
    const withdrawals = [{ id: 9, seller: account, amount: 42.25, status: 'PAID', createdAt: time, updatedAt: time }];
    const makeModel = (name, rows) => ({
        findMany: async (query) => { calls.push({ name, query }); return rows; },
        count: async ({ where }) => { calls.push({ name, where }); return 47; },
    });
    const { listAdminTransactions } = load('../src/controllers/adminTransactions.controller.ts', {
        '../../../../shared/types/adminTransaction': shared,
        '../lib/prisma': { prisma: { order: makeModel('orders', orders), withdrawalRequest: makeModel('withdrawals', withdrawals) } },
    });
    return { calls, listAdminTransactions, async request(query = {}) {
        const res = {
            statusCode: 200, headers: {},
            status(code) { this.statusCode = code; return this; },
            set(name, value) { this.headers[name] = value; return this; },
            json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; },
        };
        await listAdminTransactions({ query, user: { userId: 999 } }, res);
        return res;
    } };
}

test('the transaction ledger has a protected GET and no transaction write routes', () => {
    const authenticate = () => {};
    const admin = () => {};
    const { listAdminTransactions } = fixture();
    const registrations = [];
    load('../src/routes/dashboard.routes.ts', {
        express: { Router: () => Object.fromEntries(['get', 'patch', 'post', 'put', 'delete'].map((method) => [
            method, (path, ...handlers) => registrations.push({ method, path, handlers }),
        ])) },
        '../middleware/auth.middleware': { authenticate, requireRole: (role) => { assert.equal(role, 'ADMIN'); return admin; } },
        '../controllers/dashboard.controller': {},
        '../controllers/adminAssets.controller': {},
        '../controllers/adminTransactions.controller': { listAdminTransactions },
    });
    assert.deepEqual(registrations.filter(({ path }) => path.startsWith('/transactions')), [
        { method: 'get', path: '/transactions', handlers: [authenticate, admin, listAdminTransactions] },
    ]);
});

test('purchases span all buyers, methods and statuses by default and preserve recorded amounts', async () => {
    const view = fixture();
    const result = await view.request({ page: '2' });
    const query = view.calls[0].query;
    assert.equal(Object.keys(query.where).length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(query.orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.equal(query.skip, 20);
    assert.equal(query.take, 20);
    assert.equal(query.where, view.calls[1].where);
    assert.equal(query.select.orderItems, undefined);
    assert.equal(result.headers['Cache-Control'], 'no-store');
    assert.equal(result.body.total, 47);
    assert.equal(result.body.page, 2);
    assert.equal(result.body.items[0].totalLamports, '1');
    assert.equal(result.body.items[0].reference, 'signature');
    assert.equal(result.body.items[1].currency, 'MYR');
    assert.equal(result.body.items[1].amount, '24.9');
    assert.equal(result.body.items[1].reference, 'cs_test_example');
});

test('status, method and exact references are applied before purchase pagination', async () => {
    const view = fixture();
    await view.request({ kind: 'purchase', method: 'SOL', status: 'COMPLETED', search: ' signature ' });
    const { where } = view.calls[0].query;
    assert.equal(where.paymentMethod, 'SOL');
    assert.equal(where.paymentStatus, 'COMPLETED');
    assert.ok(where.OR.some((entry) => entry.blockchainSignature === 'signature'));
    assert.ok(where.OR.some((entry) => entry.buyer?.OR.some((field) => field.email?.contains === 'signature')));
    assert.equal(where, view.calls[1].where);
});

test('withdrawals use their own statuses and can be searched by request or seller ID', async () => {
    const view = fixture();
    const { body } = await view.request({ kind: 'withdrawal', status: 'PAID', search: 'Withdrawal #9' });
    assert.ok(view.calls.every(({ name }) => name === 'withdrawals'));
    const { where } = view.calls[0].query;
    assert.equal(where.status, 'PAID');
    assert.ok(where.OR.some((entry) => entry.id === 9));
    assert.ok(where.OR.some((entry) => entry.seller?.OR.some((field) => field.userId === 9)));
    assert.deepEqual(body.items[0], {
        id: 9, kind: 'withdrawal', account, amount: '42.25', currency: 'USD', status: 'PAID',
        createdAt: time.toISOString(), updatedAt: time.toISOString(),
    });
});

test('invalid or ambiguous filters do not query the database', async () => {
    for (const query of [
        { page: '0' }, { page: '1e2' }, { page: ['1', '2'] }, { page: '1000001' }, { kind: 'other' },
        { status: 'PAID' }, { kind: 'withdrawal', status: 'COMPLETED' }, { kind: 'withdrawal', method: 'SOL' },
        { method: 'USD' }, { search: 'x'.repeat(201) }, { search: ['one', 'two'] },
    ]) {
        const view = fixture();
        assert.equal((await view.request(query)).statusCode, 400);
        assert.deepEqual(view.calls, []);
    }
});
