const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const controller = ts.transpileModule(
    readFileSync(join(__dirname, "../src/controllers/seller.controller.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

async function loadOrders(items) {
    let query;
    const exports = {};
    runInNewContext(controller, { exports, require: () => ({ prisma: {
        orderItem: { findMany: async (args) => { query = args; return items; } },
    } }) });
    const res = { json(value) { this.body = value; } };
    await exports.getRecentOrders({ user: { userId: 7 } }, res);
    return JSON.parse(JSON.stringify({ query, body: res.body }));
}

test("recent orders are seller-scoped, bounded, and sorted newest first", async () => {
    const { query, body } = await loadOrders([]);
    assert.deepEqual(query.where, { asset: { sellerId: 7 } });
    assert.equal(query.take, 10);
    assert.deepEqual(query.orderBy, [{ order: { createdAt: "desc" } }, { id: "desc" }]);
    assert.deepEqual(body, { items: [] });
    assert.deepEqual(query.select.order.select.buyer, { select: { name: true } });
    assert.equal(query.select.licenseKey, undefined);
    assert.equal(query.select.order.select.stripePaymentId, undefined);
    assert.equal(query.select.order.select.totalAmount, undefined);
});

test("recent orders return the seller item amount and original currency without payment secrets", async () => {
    const { body } = await loadOrders([{
        id: 4, orderId: 2, licenseType: "COMMERCIAL", price: "45.50",
        asset: { title: "Forest Kit" },
        order: { createdAt: new Date("2026-10-08T10:00:00Z"), currency: "MYR", paymentStatus: "PENDING", buyer: { name: "Creator" }, stripePaymentId: "secret", totalAmount: "999.00" },
        licenseKey: "secret-license",
    }]);
    assert.deepEqual(body.items, [{
        id: 4, orderId: 2, product: "Forest Kit", buyerName: "Creator",
        licenseType: "COMMERCIAL", amount: "45.50", currency: "MYR",
        paymentStatus: "PENDING", createdAt: "2026-10-08T10:00:00.000Z",
    }]);
});
