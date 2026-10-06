const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(readFileSync(join(__dirname, '../src/lib/receipt.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exportsObject = {};
runInNewContext(code, { exports: exportsObject, require });

async function receiptBytes(itemCount) {
    const doc = exportsObject.buildReceipt({
        orderId: 9, buyerName: 'Test Buyer', createdAt: new Date('2026-10-06T04:00:00Z'),
        currency: 'MYR', totalAmount: itemCount * 25,
        items: Array.from({ length: itemCount }, (_, i) => ({ title: `Creative Asset ${i + 1}`, licenseType: 'PERSONAL', price: 25 })),
    });
    const chunks = [];
    for await (const chunk of doc) chunks.push(chunk);
    return Buffer.concat(chunks);
}

test('receipt generates a complete downloadable PDF', async () => {
    const bytes = await receiptBytes(1);
    assert.match(bytes.subarray(0, 8).toString(), /^%PDF-1\./);
    assert.match(bytes.subarray(-40).toString(), /%%EOF/);
    assert.ok(bytes.length > 1000);
});

test('larger receipts generate multiple pages without truncating the PDF', async () => {
    const bytes = await receiptBytes(50);
    assert.ok((bytes.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 1);
    assert.match(bytes.subarray(-40).toString(), /%%EOF/);
});
