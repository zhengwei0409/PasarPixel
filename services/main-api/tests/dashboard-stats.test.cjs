const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const controller = ts.transpileModule(readFileSync(join(__dirname, "../src/controllers/dashboard.controller.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

async function stats(orders = [], users = []) {
    const queries = {};
    class FixedDate extends Date {
        constructor(...args) { super(...(args.length ? args : ["2026-02-15T12:00:00Z"])); }
    }
    const prisma = {
        userProfile: { count: async () => 20, findMany: async (query) => { queries.users = query; return users; } },
        asset: { count: async ({ where }) => where.status === "PUBLISHED" ? 12 : 3 },
        sellerApplication: { count: async () => 2 }, report: { count: async () => 4 },
        order: { findMany: async (query) => {
            if (query.where.paymentMethod === "SOL") return [{ totalLamports: "9007199254740993", orderItems: [{ commissionLamports: "450359962737049" }] }];
            queries.orders = query;
            return orders;
        } },
    };
    const exports = {};
    runInNewContext(controller, { exports, Date: FixedDate, require: (name) => name === "../lib/prisma" ? { prisma } : { convert: async (amount, currency) => currency === "MYR" ? amount / 4 : amount } });
    const res = { json(body) { this.body = body; } };
    await exports.getDashboardStats({}, res);
    return JSON.parse(JSON.stringify({ body: res.body, queries }));
}

test("admin trends zero-fill six UTC months across year boundaries and split pending queues", async () => {
    const { body, queries } = await stats([], [{ createdAt: new Date("2025-09-01T00:00:00Z") }, { createdAt: new Date("2026-02-01T00:00:00Z") }]);
    assert.deepEqual(body.monthlyTrends.map((p) => p.month), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
    assert.deepEqual(body.monthlyTrends.map((p) => p.users), [1, 0, 0, 0, 0, 1]);
    assert.ok(body.monthlyTrends.every((p) => p.revenue === 0));
    assert.equal(queries.users.where.createdAt.gte, "2025-09-01T00:00:00.000Z");
    assert.deepEqual([body.pendingApplications, body.pendingAssets, body.pendingReports, body.pendingItems], [2, 3, 4, 9]);
});

test("revenue normalizes mixed currencies, preserves all-time totals, and keeps SOL separate", async () => {
    const { body, queries } = await stats([
        { totalAmount: "80", currency: "MYR", createdAt: new Date("2026-02-01T00:00:00Z") },
        { totalAmount: "15.125", currency: "USD", createdAt: new Date("2026-02-02T00:00:00Z") },
        { totalAmount: "10", currency: "USD", createdAt: new Date("2025-01-01T00:00:00Z") },
    ]);
    assert.deepEqual(queries.orders.where, { paymentStatus: "COMPLETED", paymentMethod: "STRIPE" });
    assert.equal(body.totalRevenue, 45.13);
    assert.equal(body.revenueCurrency, "USD");
    assert.equal(body.monthlyTrends.at(-1).revenue, 35.13);
    assert.equal(body.solVolumeLamports, "9007199254740993");
    assert.equal(body.solCommissionLamports, "450359962737049");
});
