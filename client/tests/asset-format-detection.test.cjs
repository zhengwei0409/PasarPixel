const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
function load(file, dependencies = {}) {
    const exports = {};
    const code = ts.transpileModule(readFileSync(join(__dirname, "../src/lib", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, require: name => dependencies[name] });
    return exports;
}
const specifications = load("assetSpecifications.ts");
const { detectAssetFormats } = load("detectAssetFormat.ts", { "./assetSpecifications": specifications });
const source = (fileUrl, fileType = "application/octet-stream", purpose = "ORIGINAL") => ({ fileUrl, fileType, purpose });
const detect = (category, files) => Array.from(detectAssetFormats(category, files));
for (const [category, options] of Object.entries(specifications.FORMAT_OPTIONS)) {
    for (const { value: extension } of options) {
        test(`preselects ${extension.toUpperCase()} for ${category} using a signed original URL`, () => {
            assert.deepEqual(detect(category, [
                source("https://example.test/cover.png", "image/png", "PREVIEW"),
                source(`https://example.test/source.${extension.toUpperCase()}?signature=example.zip`, "application/octet-stream"),
            ]), [extension]);
        });
    }
}
test("normalizes uppercase aliases, signed URLs and encoded filenames", () => {
    assert.deepEqual(detect("IMAGE", [source("https://example.test/source%2EJPG?signature=example.png#preview")]), ["jpeg"]);
    assert.deepEqual(detect("SOUND_EFFECT", [source("https://example.test/source.M4A")]), ["aac"]);
});
test("falls back to MIME type when the URL has no supported extension", () => {
    assert.deepEqual(detect("IMAGE", [source("https://example.test/source", "image/avif")]), ["avif"]);
    assert.deepEqual(detect("IMAGE", [source("https://example.test/source", "IMAGE/PNG; charset=binary")]), ["png"]);
    assert.deepEqual(detect("FONT", [source("https://example.test/source.bin", "application/x-font-truetype")]), ["ttf"]);
    assert.deepEqual(detect("VIDEO", [source("https://example.test/source", "video/quicktime")]), ["mov"]);
    assert.deepEqual(detect("SOUND_EFFECT", [source("https://example.test/source", "audio/vnd.wave")]), ["wav"]);
    assert.deepEqual(detect("THREE_D_MODEL", [source("https://example.test/source", "model/gltf-binary")]), ["glb"]);
    assert.deepEqual(detect("ANIMATION", [source("https://example.test/source", "model/gltf-binary")]), ["glb"]);
});
test("excludes previews, ZIP bundles and formats outside the selected category", () => {
    assert.deepEqual(detect("THREE_D_MODEL", [source("preview.glb", "model/gltf-binary", "PREVIEW"), source("source.zip", "application/zip"), source("cover.png", "image/png")]), []);
});
test("deduplicates formats and keeps source order for the default selection", () => {
    assert.deepEqual(detect("THREE_D_MODEL", [source("source.fbx"), source("source.obj"), source("other.FBX")]), ["fbx", "obj"]);
});
