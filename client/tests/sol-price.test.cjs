const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const exports_ = {};
runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../src/lib/price.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exports_, require: () => ({}) });
const { formatSol, solPriceInput } = exports_;

test('SOL prices retain lamport precision in display and editable server values', () => {
    assert.equal(formatSol('1e-9'), '0.000000001 SOL');
    assert.equal(solPriceInput('1.23e-7'), '0.000000123');
    assert.equal(solPriceInput('18446744073.709551615'), '18446744073.709551615');
    assert.equal(formatSol('18446744073.709551615'), '18446744073.709551615 SOL');
    assert.equal(formatSol('0.010000000'), '0.01 SOL');
    assert.equal(formatSol(1), '1.00 SOL');
    assert.equal(solPriceInput('1e+2'), '100');
});

test('missing, zero and invalid SOL values retain clear display labels', () => {
    assert.equal(formatSol(null), '—');
    assert.equal(formatSol('0'), 'Free');
    for (const value of ['NaN', 'Infinity', '1 SOL', '1e-10', '-1', '1e+999']) {
        assert.equal(formatSol(value), '—');
        assert.equal(solPriceInput(value), '');
    }
});
