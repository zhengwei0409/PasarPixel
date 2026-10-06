const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const plain = value => JSON.parse(JSON.stringify(value));
const compiled = ts.transpileModule(
    readFileSync(join(__dirname, '../src/controllers/checkout.controller.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = plain(body); return this; },
    };
}

function fixture() {
    const cart = [
        { id: 1, userId: 7, assetId: 10, licenseType: 'PERSONAL', asset: { id: 10, title: 'Model', status: 'PUBLISHED', isDeleted: false, pricePersonal: '25', priceCommercial: '50', currency: 'USD', sellerId: 3 } },
        { id: 2, userId: 7, assetId: 20, licenseType: 'COMMERCIAL', asset: { id: 20, title: 'Image', status: 'PUBLISHED', isDeleted: false, pricePersonal: '10', priceCommercial: '30', currency: 'USD', sellerId: 4 } },
        { id: 3, userId: 8, assetId: 30, licenseType: 'PERSONAL', asset: { id: 30, title: 'Other buyer asset', status: 'PUBLISHED', isDeleted: false, pricePersonal: '99', currency: 'USD', sellerId: 4 } },
    ];
    const state = { cart, notifications: [] };
    const prisma = {
        cartItem: {
            findMany: async ({ where }) => {
                state.query = plain(where);
                return cart.filter(item => item.userId === where.userId && (!where.id || where.id.in.includes(item.id)));
            },
            deleteMany: async ({ where }) => {
                state.deleted = plain(where);
                state.remaining = cart.filter(item => !(item.userId === where.userId && where.OR.some(match => match.assetId === item.assetId && match.licenseType === item.licenseType)));
            },
        },
        order: {
            updateMany: async () => {},
            create: async ({ data }) => {
                state.order = plain(data);
                state.persisted = { id: 9, buyerId: 7, paymentStatus: 'PENDING', stripePaymentId: 'cs_9', orderItems: data.orderItems.create.map(item => ({ ...item, asset: cart.find(row => row.assetId === item.assetId).asset })) };
                return { id: 9 };
            },
            findUnique: async () => state.persisted,
            update: async ({ data }) => { Object.assign(state.persisted, data); },
        },
    };
    const stripe = {
        checkout: { sessions: {
            create: async (args) => { state.session = plain(args); return { id: 'cs_9', url: 'https://checkout.example/session' }; },
            retrieve: async () => ({ payment_status: 'paid' }),
        } },
        webhooks: { constructEvent: () => ({ type: 'checkout.session.completed', data: { object: { metadata: { orderId: '9' } } } }) },
    };
    const exports = {};
    runInNewContext(compiled, {
        exports,
        process: { env: { STRIPE_WEBHOOK_SECRET: 'test-secret' } },
        console,
        require: name => {
            if (name === '../lib/prisma') return { prisma };
            if (name === '../lib/stripe') return { stripe };
            if (name === '../lib/currency') return { convert: async amount => amount };
            if (name === '../lib/publisher') return {
                publishOrderPaid: async payload => state.notifications.push(plain(payload)),
                publishAssetSold: async () => {},
            };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return { handlers: exports, state };
}

const request = body => ({ user: { userId: 7 }, body });

test('checkout charges only selected assets at the stored license price', async () => {
    const { handlers, state } = fixture();
    // An unavailable unselected asset must not prevent checkout.
    state.cart[0].asset.status = 'TAKEN_DOWN';
    const res = response();
    await handlers.createCheckoutSession(request({ currency: 'USD', cartItemIds: [2], total: 0 }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(state.query, { userId: 7, id: { in: [2] } });
    assert.equal(state.order.totalAmount, 30);
    assert.deepEqual(state.order.orderItems.create, [{ assetId: 20, licenseType: 'COMMERCIAL', price: 30 }]);
    assert.equal(state.session.line_items.length, 1);
    assert.equal(state.session.line_items[0].price_data.unit_amount, 3000);
});

test('empty and malformed selections are rejected before querying or charging', async () => {
    for (const cartItemIds of [[], null, '1', [0], [-1], [1.5], ['1'], [Number.MAX_SAFE_INTEGER + 1]]) {
        const { handlers, state } = fixture();
        const res = response();
        await handlers.createCheckoutSession(request({ currency: 'USD', cartItemIds }), res);
        assert.equal(res.statusCode, 400);
        assert.equal(state.query, undefined);
        assert.equal(state.session, undefined);
    }
});

test('missing IDs or another buyer’s IDs reject the entire selection', async () => {
    for (const cartItemIds of [[999], [3], [1, 3], [1, 999]]) {
        const { handlers, state } = fixture();
        const res = response();
        await handlers.createCheckoutSession(request({ currency: 'USD', cartItemIds }), res);
        assert.equal(res.statusCode, 409);
        assert.equal(state.order, undefined);
        assert.equal(state.session, undefined);
    }
});

test('repeated IDs are charged once', async () => {
    const { handlers, state } = fixture();
    await handlers.createCheckoutSession(request({ currency: 'USD', cartItemIds: [1, 1] }), response());
    assert.equal(state.session.line_items.length, 1);
    assert.equal(state.order.totalAmount, 25);
});

test('older clients omitting selection still checkout their own full cart', async () => {
    const { handlers, state } = fixture();
    await handlers.createCheckoutSession(request({ currency: 'USD' }), response());
    assert.deepEqual(state.query, { userId: 7 });
    assert.equal(state.session.line_items.length, 2);
    assert.equal(state.order.totalAmount, 55);
});

for (const path of ['verify', 'webhook']) {
    test(`${path} fulfilment preserves unselected assets and other buyers’ carts`, async () => {
        const { handlers, state } = fixture();
        await handlers.createCheckoutSession(request({ currency: 'USD', cartItemIds: [2] }), response());
        // A new asset added while paying must also remain in the cart.
        state.cart.push({ id: 4, userId: 7, assetId: 40, licenseType: 'PERSONAL' });
        const fulfil = () => path === 'verify'
            ? handlers.verifyCheckout({ user: { userId: 7 }, params: { orderId: '9' } }, response())
            : handlers.handleWebhook({ headers: { 'stripe-signature': 'test' }, body: Buffer.from('test') }, response());
        await fulfil();
        assert.equal(state.persisted.paymentStatus, 'COMPLETED');
        assert.deepEqual(state.remaining.map(item => item.id), [1, 3, 4]);
        assert.equal(state.notifications[0].itemCount, 1);
        await fulfil();
        assert.equal(state.notifications.length, 1);
    });
}
