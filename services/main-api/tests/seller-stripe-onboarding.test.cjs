const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(
    readFileSync(join(__dirname, '../src/controllers/sellerStripe.controller.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function fixture(isStripeSandbox = true) {
    const state = { accounts: new Map(), creates: [], links: [], failLink: false, cardsActive: false };
    const prisma = {
        userProfile: {
            findUnique: async ({ where: { userId } }) => ({
                createdAt: new Date('2026-11-13T00:00:00Z'),
                stripeAccount: state.accounts.get(userId),
            }),
        },
        sellerStripeAccount: {
            findUnique: async ({ where: { sellerId } }) => state.accounts.get(sellerId),
            createMany: async ({ data }) => state.accounts.set(data.sellerId, data),
        },
    };
    const stripe = {
        accounts: {
            retrieve: async (id) => {
                if (id === null) return { country: 'MY' };
                assert.equal(id, 'acct_seller');
                return { charges_enabled: true, capabilities: { card_payments: state.cardsActive ? 'active' : 'pending' } };
            },
        },
        v2: {
            core: {
                accounts: {
                    create: async (params, options) => {
                        state.creates.push({ params, options });
                        return { id: 'acct_seller' };
                    },
                },
                accountLinks: {
                    create: async (params) => {
                        state.links.push(params);
                        if (state.failLink) throw new Error('Link creation failed');
                        return { url: 'https://accounts.stripe.com/test-link' };
                    },
                },
            },
        },
    };
    const handlers = {};
    runInNewContext(compiled, {
        exports: handlers, URL, process: { env: { CLIENT_URL: 'http://localhost:5173' } },
        console: { error() {} },
        require: name => {
            if (name === '../lib/prisma') return { prisma };
            if (name === '../lib/stripe') return {
                stripe, isStripeSandbox,
                canAcceptStripeCards: account => account.charges_enabled && account.capabilities.card_payments === 'active',
            };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });

    async function call(handler) {
        const req = { user: { userId: 5 }, body: { sellerId: 19, stripeAccountId: 'acct_wrong' } };
        const res = {
            statusCode: 200,
            set() {},
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; },
        };
        await handlers[handler](req, res);
        return res;
    }
    return { state, start: () => call('startSellerStripeOnboarding'), status: () => call('getSellerStripeStatus') };
}

test('seller resumes Stripe onboarding using the account saved before link creation failed', async () => {
    const { state, start, status } = fixture();
    assert.equal((await status()).body.status, 'not_connected');
    state.failLink = true;
    assert.equal((await start()).statusCode, 502);
    assert.equal(state.accounts.get(5).stripeAccountId, 'acct_seller');
    assert.equal(state.accounts.has(19), false);
    assert.equal(state.creates[0].params.metadata.pasarpixel_seller_id, '5');
    assert.equal(state.creates[0].params.identity.country, 'my');
    assert.equal((await status()).body.status, 'needs_onboarding');

    state.failLink = false;
    assert.equal((await start()).body.url, 'https://accounts.stripe.com/test-link');
    assert.equal(state.creates.length, 1);
    assert.equal(state.links[1].account, 'acct_seller');
    const onboarding = state.links[1].use_case.account_onboarding;
    assert.equal(onboarding.configurations.join(','), 'merchant');
    assert.equal(onboarding.return_url, 'http://localhost:5173/settings#stripe-payments');
    assert.equal(onboarding.refresh_url, 'http://localhost:5173/settings?stripe=refresh#stripe-payments');
    assert.equal((await status()).body.status, 'needs_onboarding');
    state.cardsActive = true;
    assert.equal((await status()).body.status, 'ready');
});

test('seller onboarding is disabled outside the Stripe Sandbox', async () => {
    const { state, start, status } = fixture(false);
    assert.equal((await status()).body.status, 'unavailable');
    assert.equal((await start()).statusCode, 503);
    assert.equal(state.creates.length, 0);
    assert.equal(state.links.length, 0);
});
