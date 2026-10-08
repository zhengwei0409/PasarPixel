const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const controller = ts.transpileModule(
    readFileSync(join(__dirname, "../src/controllers/asset.controller.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const published = { id: 1, sellerId: 7, status: "PUBLISHED", isDeleted: false, description: "Original" };

async function update(body, asset = published) {
    let saved;
    let where;
    const prisma = { asset: {
        findUnique: async () => asset,
        update: async (args) => {
            saved = JSON.parse(JSON.stringify(args.data));
            where = JSON.parse(JSON.stringify(args.where));
            return { ...asset, ...args.data };
        },
    } };
    const exports = {};
    runInNewContext(controller, { exports, require: name => name === "../lib/prisma" ? { prisma } : {} });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await exports.updateAsset({ user: { userId: 7 }, params: { id: "1" }, body }, res);
    return { saved, where, res };
}

test("owner can update a published description without changing other fields or status", async () => {
    const result = await update({ description: "  Updated description  " });
    assert.equal(result.res.statusCode, 200);
    assert.deepEqual(result.saved, { description: "Updated description" });
    assert.deepEqual(result.where, { id: 1, sellerId: 7, status: "PUBLISHED", isDeleted: false });
    assert.equal(result.res.body.status, "PUBLISHED");
});

test("published description can be cleared", async () => {
    const result = await update({ description: "   " });
    assert.equal(result.res.statusCode, 200);
    assert.deepEqual(result.saved, { description: null });
});

test("published edits reject all additional fields, including unknown fields", async () => {
    for (const field of ["title", "category", "listingType", "isAiGenerated", "audioType", "pricePersonal", "priceCommercial", "priceSol", "currency", "technicalSpecifications", "status", "sellerId", "files", "unknown"]) {
        const result = await update({ description: "Updated", [field]: "changed" });
        assert.equal(result.res.statusCode, 409, field);
        assert.equal(result.saved, undefined, field);
    }
});

test("published edits require a description field", async () => {
    for (const body of [{}, { title: "Changed" }]) {
        const result = await update(body);
        assert.equal(result.res.statusCode, 409);
        assert.equal(result.saved, undefined);
    }
});

test("published edits require a string description", async () => {
    for (const body of [{ description: null }, { description: 1 }, { description: false }, { description: [] }, { description: {} }]) {
        const result = await update(body);
        assert.equal(result.res.statusCode, 400);
        assert.equal(result.saved, undefined);
    }
});

test("description editing enforces ownership and rejects missing or deleted assets", async () => {
    for (const [asset, status] of [[{ ...published, sellerId: 8 }, 403], [null, 404], [{ ...published, isDeleted: true }, 404]]) {
        const result = await update({ description: "Updated" }, asset);
        assert.equal(result.res.statusCode, status);
        assert.equal(result.saved, undefined);
    }
});

test("reviewing, rejected and taken-down listings cannot be directly edited", async () => {
    for (const status of ["PENDING_REVIEW", "REJECTED", "TAKEN_DOWN"]) {
        const result = await update({ description: "Updated" }, { ...published, status });
        assert.equal(result.res.statusCode, 409);
        assert.equal(result.saved, undefined);
    }
});
