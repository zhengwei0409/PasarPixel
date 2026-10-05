const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const source = readFileSync(join(__dirname, "../src/controllers/asset.controller.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const plain = (value) => JSON.parse(JSON.stringify(value));

// Exercise the browse handler with isolated database responses. The asset
// fetch deliberately returns a different order from the sales ranking.
async function browse(query, rankedIds = [2, 1]) {
    const calls = {};
    const prisma = {
        orderItem: {
            groupBy: async (args) => {
                calls.sales = plain(args);
                return rankedIds.map((assetId) => ({ assetId }));
            },
        },
        asset: {
            findMany: async (args) => {
                calls.assets = plain(args);
                return [1, 2].filter((id) => !args.where.id || args.where.id.in.includes(id)).map((id) => ({ id }));
            },
            count: async (args) => { calls.count = plain(args); return rankedIds.length; },
        },
        review: { groupBy: async () => [{ assetId: 2, _avg: { rating: 4.5 }, _count: 2 }] },
    };
    const exports = {};
    runInNewContext(compiled, {
        exports,
        require: (name) => {
            if (name === "../lib/prisma") return { prisma };
            if (name === "@prisma/client" || name.startsWith("../lib/")) return {};
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    const response = { json(value) { this.body = plain(value); } };
    await exports.browseAssets({ query }, response);
    return { body: response.body, calls };
}

test("best selling preserves sales rank and existing rating summaries", async () => {
    const { body, calls } = await browse({ sort: "best_selling", pageSize: "4" });
    assert.deepEqual(body.items.map((asset) => asset.id), [2, 1]);
    assert.equal(body.items[0].averageRating, 4.5);
    assert.equal(body.items[0].reviewCount, 2);
    assert.equal(body.pageSize, 4);
    assert.deepEqual(calls.sales.orderBy, [{ _count: { assetId: "desc" } }, { assetId: "desc" }]);
});

test("sales ranking and totals include only completed purchases of public assets", async () => {
    const { calls } = await browse({ sort: "best_selling" });
    assert.deepEqual(calls.sales.where.order, { paymentStatus: "COMPLETED" });
    assert.equal(calls.sales.where.asset.status, "PUBLISHED");
    assert.equal(calls.sales.where.asset.isDeleted, false);
    assert.deepEqual(calls.count.where.orderItems, { some: { order: { paymentStatus: "COMPLETED" } } });
});

test("keyword and category filters apply before sales ranking", async () => {
    const { calls } = await browse({ sort: "best_selling", keyword: "  chair  ", category: "THREE_D_MODEL" });
    assert.equal(calls.sales.where.asset.category, "THREE_D_MODEL");
    assert.deepEqual(calls.sales.where.asset.OR, [
        { title: { contains: "chair", mode: "insensitive" } },
        { description: { contains: "chair", mode: "insensitive" } },
    ]);
});

test("sales pagination applies once to the ranking, then fetches those assets", async () => {
    const { calls } = await browse({ sort: "best_selling", page: "3", pageSize: "4" });
    assert.equal(calls.sales.skip, 8);
    assert.equal(calls.sales.take, 4);
    assert.equal(calls.assets.skip, 0);
    assert.deepEqual(calls.assets.where.id.in, [2, 1]);
});

test("no completed sales returns an empty list", async () => {
    const { body } = await browse({ sort: "best_selling" }, []);
    assert.deepEqual(body.items, []);
    assert.equal(body.total, 0);
});

test("newest and unknown sorts retain normal chronological pagination", async () => {
    for (const sort of ["newest", "invalid"]) {
        const { calls } = await browse({ sort, page: "2", pageSize: "4" });
        assert.equal(calls.sales, undefined);
        assert.deepEqual(calls.assets.orderBy, { createdAt: "desc" });
        assert.equal(calls.assets.skip, 4);
        assert.equal(calls.count.where.orderItems, undefined);
    }
});
