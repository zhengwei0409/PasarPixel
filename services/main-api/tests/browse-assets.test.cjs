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
        assetFile: { fields: { height: "height-field-reference" } },
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


test("image filters match the same original file before pagination, ranking, and totals", async () => {
    const { calls } = await browse({ category: "IMAGE", sort: "best_selling", imageOrientation: "landscape,square", imageMinResolution: "3840", imageFormat: "png,jpeg" });
    const file = calls.assets.where.files.some;
    assert.equal(file.purpose, "ORIGINAL");
    assert.deepEqual(file.fileType.in, ["image/png", "image/jpeg", "image/jpg"]);
    assert.deepEqual(file.AND, [
        { OR: [{ width: { gt: "height-field-reference" } }, { width: { equals: "height-field-reference" } }] },
        { OR: [{ width: { gte: 3840 } }, { height: { gte: 3840 } }] },
    ]);
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("HD includes portrait images by their longest side", async () => {
    const { calls } = await browse({ category: "IMAGE", imageOrientation: "portrait", imageMinResolution: "1920" });
    assert.deepEqual(calls.assets.where.files.some.AND, [
        { OR: [{ width: { lt: "height-field-reference" } }] },
        { OR: [{ width: { gte: 1920 } }, { height: { gte: 1920 } }] },
    ]);
});

test("AVIF filtering matches original images before ranking, pagination and totals", async () => {
    const { calls } = await browse({ category: "IMAGE", sort: "best_selling", imageFormat: "avif" });
    assert.equal(calls.assets.where.files.some.purpose, "ORIGINAL");
    assert.deepEqual(calls.assets.where.files.some.fileType.in, ["image/avif"]);
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("image filters do not constrain other multimedia categories", async () => {
    for (const category of [undefined, "VIDEO", "THREE_D_MODEL"]) {
        const { calls } = await browse({ category, imageOrientation: "landscape", imageMinResolution: "3840", imageFormat: "png" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("unsupported image filters, including 8K, are ignored", async () => {
    const { calls } = await browse({ category: "IMAGE", imageOrientation: "invalid", imageMinResolution: "7680", imageFormat: "__proto__,invalid" });
    assert.equal(calls.assets.where.files, undefined);
});


test("video filters match a single original and apply before pagination and sales ranking", async () => {
    const { calls } = await browse({ category: "VIDEO", sort: "best_selling", videoOrientation: "portrait,square", videoMinResolution: "1080", videoFormat: "mp4,mov", videoMinDuration: "10.5", videoMaxDuration: "60", videoMinFrameRate: "30" });
    const file = calls.assets.where.files.some;
    assert.equal(file.purpose, "ORIGINAL");
    assert.deepEqual(file.fileType.in, ["video/mp4", "video/quicktime"]);
    assert.deepEqual(file.AND, [
        { OR: [{ width: { lt: "height-field-reference" } }, { width: { equals: "height-field-reference" } }] },
        { width: { gte: 1080 }, height: { gte: 1080 } },
        { durationSeconds: { gte: 10.5, lte: 60 } },
        { frameRate: { gte: 30 } },
    ]);
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("video filters leave image, animation, and unselected-category queries unaffected", async () => {
    for (const category of [undefined, "IMAGE", "ANIMATION"]) {
        const { calls } = await browse({ category, videoMinResolution: "2160", videoFormat: "webm", videoMaxDuration: "60", videoMinFrameRate: "60" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("invalid video filter values are ignored and blank durations impose no limit", async () => {
    for (const duration of ["", " ", "-1", "Infinity", "invalid"]) {
        const { calls } = await browse({ category: "VIDEO", videoMinDuration: duration, videoMaxDuration: duration, videoMinFrameRate: "invalid", videoMinResolution: "7680", videoFormat: "__proto__" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("zero maximum duration is preserved and AVI MIME variants are accepted", async () => {
    const { calls } = await browse({ category: "VIDEO", videoMaxDuration: "0", videoFormat: "avi" });
    assert.deepEqual(calls.assets.where.files.some.AND, [{ durationSeconds: { lte: 0 } }]);
    assert.deepEqual(calls.assets.where.files.some.fileType.in, ["video/x-msvideo", "video/avi", "video/msvideo"]);
});

test("audio format and duration match one original before ranking and totals", async () => {
    const { calls } = await browse({ category: "SOUND_EFFECT", sort: "best_selling", audioFormat: "mp3,wav", audioMinDuration: "2.5", audioMaxDuration: "90" });
    assert.deepEqual(calls.assets.where.files.some, {
        purpose: "ORIGINAL",
        fileType: { in: ["audio/mpeg", "audio/mp3", "audio/x-mp3", "audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"] },
        durationSeconds: { gte: 2.5, lte: 90 },
    });
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("audio duration accepts zero and decimals without requiring a format", async () => {
    const { calls } = await browse({ category: "SOUND_EFFECT", audioMinDuration: "0", audioMaxDuration: "0.75" });
    assert.deepEqual(calls.assets.where.files.some, {
        purpose: "ORIGINAL", fileType: { startsWith: "audio/" }, durationSeconds: { gte: 0, lte: 0.75 },
    });
});

test("audio filters leave other categories unaffected and ignore invalid values", async () => {
    for (const category of [undefined, "IMAGE", "VIDEO", "ANIMATION"]) {
        const { calls } = await browse({ category, audioFormat: "mp3", audioMinDuration: "5" });
        assert.equal(calls.assets.where.files, undefined);
    }
    for (const value of ["", " ", "-1", "NaN", "Infinity", ["5", "10"]]) {
        const { calls } = await browse({ category: "SOUND_EFFECT", audioFormat: "__proto__,invalid", audioMinDuration: value, audioMaxDuration: value });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("font formats match original files before pagination, ranking, and totals", async () => {
    const { calls } = await browse({ category: "FONT", sort: "best_selling", fontFormat: "ttf,woff2" });
    const file = calls.assets.where.files.some;
    assert.equal(file.purpose, "ORIGINAL");
    assert.deepEqual(file.OR, [
        { fileType: { in: ["font/ttf", "application/x-font-ttf", "application/x-font-truetype"] } },
        { fileUrl: { endsWith: ".ttf", mode: "insensitive" } },
        { fileType: { in: ["font/woff2", "application/font-woff2", "application/x-font-woff2"] } },
        { fileUrl: { endsWith: ".woff2", mode: "insensitive" } },
    ]);
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("each supported font format includes an extension fallback for generic MIME uploads", async () => {
    for (const format of ["ttf", "otf", "woff", "woff2"]) {
        const { calls } = await browse({ category: "FONT", fontFormat: format });
        const options = calls.assets.where.files.some.OR;
        assert.ok(options[0].fileType.in.includes(`font/${format}`));
        assert.deepEqual(options[1], { fileUrl: { endsWith: `.${format}`, mode: "insensitive" } });
    }
});

test("font filters leave other category results unaffected", async () => {
    for (const category of [undefined, "IMAGE", "VIDEO", "SOUND_EFFECT", "ANIMATION", "THREE_D_MODEL"]) {
        const { calls } = await browse({ category, fontFormat: "ttf,otf,woff,woff2" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("font filtering ignores unsupported values and deduplicates valid choices", async () => {
    const invalid = await browse({ category: "FONT", fontFormat: "__proto__,constructor,eot,invalid" });
    assert.equal(invalid.calls.assets.where.files, undefined);
    const mixed = await browse({ category: "FONT", fontFormat: "woff,woff,invalid" });
    assert.equal(mixed.calls.assets.where.files.some.OR.length, 2);
});

test("3D formats match original download extensions before ranking and totals", async () => {
    const { calls } = await browse({ category: "THREE_D_MODEL", sort: "best_selling", modelFormat: "glb,fbx,blend" });
    assert.deepEqual(calls.assets.where.files.some, {
        purpose: "ORIGINAL",
        OR: ["glb", "fbx", "blend"].map((format) => ({ fileUrl: { endsWith: `.${format}`, mode: "insensitive" } })),
    });
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("all six 3D formats use exact extensions and exclude preview files", async () => {
    for (const format of ["glb", "gltf", "fbx", "obj", "blend", "stl"]) {
        const { calls } = await browse({ category: "THREE_D_MODEL", modelFormat: format });
        assert.deepEqual(calls.assets.where.files.some, {
            purpose: "ORIGINAL",
            OR: [{ fileUrl: { endsWith: `.${format}`, mode: "insensitive" } }],
        });
    }
});

test("3D format filters leave other categories unaffected", async () => {
    for (const category of [undefined, "IMAGE", "VIDEO", "SOUND_EFFECT", "FONT", "ANIMATION"]) {
        const { calls } = await browse({ category, modelFormat: "glb,fbx" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("3D format filtering ignores unsupported values and deduplicates choices", async () => {
    const invalid = await browse({ category: "THREE_D_MODEL", modelFormat: "__proto__,constructor,zip,invalid" });
    assert.equal(invalid.calls.assets.where.files, undefined);
    const mixed = await browse({ category: "THREE_D_MODEL", modelFormat: "obj,obj,invalid" });
    assert.deepEqual(mixed.calls.assets.where.files.some.OR, [{ fileUrl: { endsWith: ".obj", mode: "insensitive" } }]);
});

test("animation formats match original downloads before ranking and totals", async () => {
    const { calls } = await browse({ category: "ANIMATION", sort: "best_selling", animationFormat: "glb,fbx,blend" });
    assert.deepEqual(calls.assets.where.files.some, {
        purpose: "ORIGINAL",
        OR: ["glb", "fbx", "blend"].map((format) => ({ fileUrl: { endsWith: `.${format}`, mode: "insensitive" } })),
    });
    assert.deepEqual(calls.sales.where.asset.files, calls.assets.where.files);
    assert.deepEqual(calls.count.where.files, calls.assets.where.files);
});

test("animation formats exclude preview files and ignore unsupported formats", async () => {
    for (const format of ["glb", "fbx", "blend"]) {
        const { calls } = await browse({ category: "ANIMATION", animationFormat: `${format},${format},mp4,obj,__proto__` });
        assert.deepEqual(calls.assets.where.files.some, {
            purpose: "ORIGINAL",
            OR: [{ fileUrl: { endsWith: `.${format}`, mode: "insensitive" } }],
        });
    }
    const { calls } = await browse({ category: "ANIMATION", animationFormat: "mp4,obj,gltf,stl,__proto__,constructor" });
    assert.equal(calls.assets.where.files, undefined);
});

test("animation format filters leave other categories unaffected", async () => {
    for (const category of [undefined, "IMAGE", "VIDEO", "SOUND_EFFECT", "FONT", "THREE_D_MODEL"]) {
        const { calls } = await browse({ category, animationFormat: "glb,fbx,blend" });
        assert.equal(calls.assets.where.files, undefined);
    }
});

test("music and sound effect filters apply before pagination, sales ranking, and totals", async () => {
    for (const audioType of ["MUSIC", "SOUND_EFFECT", "MUSIC,SOUND_EFFECT"]) {
        const { calls } = await browse({ category: "SOUND_EFFECT", audioType, sort: "best_selling" });
        const expected = { in: audioType.split(",") };
        assert.deepEqual(calls.assets.where.audioType, expected);
        assert.deepEqual(calls.sales.where.asset.audioType, expected);
        assert.deepEqual(calls.count.where.audioType, expected);
    }
});

test("audio type combines with format and duration; invalid values and other categories are ignored", async () => {
    const { calls } = await browse({ category: "SOUND_EFFECT", audioType: "MUSIC", audioFormat: "mp3", audioMinDuration: "30" });
    assert.deepEqual(calls.assets.where.audioType, { in: ["MUSIC"] });
    assert.equal(calls.assets.where.files.some.purpose, "ORIGINAL");
    assert.deepEqual(calls.assets.where.files.some.durationSeconds, { gte: 30 });
    for (const query of [{ category: "SOUND_EFFECT", audioType: "invalid" }, { category: "IMAGE", audioType: "MUSIC" }, { category: "SOUND_EFFECT" }]) {
        const result = await browse(query);
        assert.equal(result.calls.assets.where.audioType, undefined);
    }
});
