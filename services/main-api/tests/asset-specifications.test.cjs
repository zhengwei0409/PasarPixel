const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const compile = (path) => ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const validation = {};
runInNewContext(compile(join(__dirname, "../src/lib/assetSpecifications.ts")), { exports: validation });
const controller = compile(join(__dirname, "../src/controllers/asset.controller.ts"));
const draft = { id: 1, sellerId: 7, status: "DRAFT", category: "IMAGE" };
async function update(body, asset = draft) {
    let saved;
    const prisma = { asset: { findUnique: async () => asset, update: async ({ data }) => { saved = JSON.parse(JSON.stringify(data)); return { ...asset, ...data }; } } };
    const exports = {};
    runInNewContext(controller, { exports, require: name => name === "../lib/prisma" ? { prisma } : name === "../lib/assetSpecifications" ? validation : {} });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    await exports.updateAsset({ user: { userId: 7 }, params: { id: "1" }, body }, res);
    return { saved, res };
}
test("frontend marketplace formats and backend validation stay consistent", () => {
    const frontend = {};
    runInNewContext(compile(join(__dirname, "../../../client/src/lib/assetSpecifications.ts")), { exports: frontend });
    assert.deepEqual(JSON.parse(JSON.stringify(frontend.FORMAT_OPTIONS)), JSON.parse(JSON.stringify(validation.FORMAT_OPTIONS)));
});
test("each category persists its formats and applicable attributes", async () => {
    for (const category of Object.keys(validation.FORMAT_OPTIONS)) {
        const technicalSpecifications = { formats: validation.FORMAT_OPTIONS[category].map(option => option.value) };
        if (category === "IMAGE" || category === "VIDEO") Object.assign(technicalSpecifications, { width: 1920, height: 1080, orientation: "landscape" });
        if (category === "VIDEO" || category === "SOUND_EFFECT") technicalSpecifications.durationSeconds = 3.5;
        if (category === "VIDEO") technicalSpecifications.frameRate = 29.97;
        const result = await update({ technicalSpecifications }, { ...draft, category, audioType: "MUSIC" });
        assert.equal(result.res.statusCode, 200);
        assert.deepEqual(result.saved.technicalSpecifications, JSON.parse(JSON.stringify(technicalSpecifications)));
    }
});
test("invalid formats, measurements and category attributes cannot be saved", async () => {
    for (const technicalSpecifications of [null, [], {}, { formats: [] }, { formats: ["wav"] }, { formats: ["png"], width: 1 }, { formats: ["png"], width: -1, height: 10 }, { formats: ["png"], width: 1.5, height: 10 }, { formats: ["png"], orientation: "portrait", width: 1920, height: 1080 }, { formats: ["png"], durationSeconds: 1 }, { formats: ["png"], width: Infinity, height: 10 }]) {
        const result = await update({ technicalSpecifications });
        assert.equal(result.res.statusCode, 400);
        assert.equal(result.saved, undefined);
    }
});
test("other edits preserve specifications and changing category clears obsolete ones", async () => {
    assert.equal((await update({ title: "Renamed" })).saved.technicalSpecifications, undefined);
    assert.deepEqual((await update({ category: "FONT" })).saved.technicalSpecifications, {});
});
test("specification edits enforce ownership and draft status", async () => {
    const body = { technicalSpecifications: { formats: ["png"] } };
    assert.equal((await update(body, { ...draft, sellerId: 8 })).res.statusCode, 403);
    assert.equal((await update(body, { ...draft, status: "PUBLISHED" })).res.statusCode, 409);
});
