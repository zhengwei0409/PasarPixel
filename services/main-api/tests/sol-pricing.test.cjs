const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { Prisma } = require('@prisma/client');
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const parser = {};
runInNewContext(compile(join(__dirname, '../../../shared/utils/solPrice.ts')), { exports: parser });
const controller = compile(join(__dirname, '../src/controllers/asset.controller.ts'));

async function update(body, overrides = {}) {
    let written;
    const asset = { id: 1, sellerId: 2, status: 'DRAFT', category: 'IMAGE', listingType: 'BLOCKCHAIN',
        pricePersonal: null, priceCommercial: null, priceSol: new Prisma.Decimal('0.000000001'),
        priceSolPersonal: new Prisma.Decimal('0.000000001'), priceSolCommercial: null, ...overrides };
    const exports = {};
    runInNewContext(controller, { exports, require: name => {
        if (name === '@prisma/client') return { Prisma };
        if (name === '../../../../shared/utils/solPrice') return parser;
        if (name === '../lib/prisma') return { prisma: { asset: { findUnique: async () => asset,
            update: async ({ data }) => { written = data; return { ...asset, ...data }; } } } };
        if (name.startsWith('../lib/')) return {};
        throw new Error(`Unexpected dependency: ${name}`);
    } });
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; } };
    await exports.updateAsset({ user: { userId: 2 }, params: { id: '1' }, body }, response);
    return { response, written };
}

test('tier edits preserve an existing one-lamport price and exact maximum u64 price', async () => {
    const { response, written } = await update({ priceSolCommercial: '18446744073.709551615' });
    assert.equal(response.statusCode, 200);
    assert.equal(written.priceSol.toFixed(9), '0.000000001');
    assert.equal(written.priceSolCommercial.toFixed(9), '18446744073.709551615');
});

test('clearing the final SOL tier clears the derived browsing price', async () => {
    const { response, written } = await update({ priceSolPersonal: null, priceSolCommercial: null });
    assert.equal(response.statusCode, 200);
    assert.equal(written.priceSol, null);
    assert.equal(written.priceSolPersonal, null);
    assert.equal(written.priceSolCommercial, null);
});

test('invalid SOL prices and fiat listings with SOL prices are rejected without writes', async () => {
    for (const body of [{ priceSolPersonal: '1e-9' }, { priceSolPersonal: '0' },
        { priceSolCommercial: '18446744073.709551616' }, { listingType: 'TRADITIONAL', priceSolCommercial: '1' }]) {
        const { response, written } = await update(body);
        assert.equal(response.statusCode, 400);
        assert.equal(written, undefined);
    }
});
