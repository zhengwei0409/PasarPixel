const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const compile = path => ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const validation = {};
runInNewContext(compile(join(__dirname, '../src/lib/assetSpecifications.ts')), { exports: validation });
const frontend = {};
runInNewContext(compile(join(__dirname, '../../../client/src/lib/assetSpecifications.ts')), { exports: frontend });
const controller = compile(join(__dirname, '../src/controllers/asset.controller.ts'));
const cases = [
    ['IMAGE', 'picture.JPG', 'image/jpeg', 'ORIGINAL', true],
    ['IMAGE', 'clip.mp4', 'video/mp4', 'ORIGINAL', false],
    ['VIDEO', 'clip.MOV', 'video/quicktime', 'ORIGINAL', true],
    ['VIDEO', 'bundle.zip', 'application/zip', 'ORIGINAL', false],
    ['SOUND_EFFECT', 'track.M4A', 'audio/mp4', 'ORIGINAL', true],
    ['SOUND_EFFECT', 'cover.png', 'image/png', 'ORIGINAL', false],
    ['FONT', 'font.woff2', '', 'ORIGINAL', true],
    ['FONT', 'bundle.zip', 'application/zip', 'ORIGINAL', false],
    ['THREE_D_MODEL', 'source.FBX', 'application/octet-stream', 'ORIGINAL', true],
    ['THREE_D_MODEL', 'bundle.ZIP', 'application/x-zip-compressed', 'ORIGINAL', true],
    ['ANIMATION', 'bundle.zip', 'application/zip', 'ORIGINAL', true],
    ['ANIMATION', 'source.glb', 'model/gltf-binary', 'ORIGINAL', true],
    ['ANIMATION', 'clip.mp4', 'video/mp4', 'ORIGINAL', false],
    ['THREE_D_MODEL', 'texture.png', 'image/png', 'ORIGINAL', false],
    ['THREE_D_MODEL', 'bundle.zip', 'application/zip', 'PREVIEW', false],
    ['THREE_D_MODEL', 'preview.glb', 'application/octet-stream', 'PREVIEW', true],
    ['VIDEO', 'cover.png', 'image/png', 'PREVIEW', true],
    ['ANIMATION', 'preview.mp4', 'video/mp4', 'PREVIEW', true],
    ['ANIMATION', 'preview.mov', 'video/quicktime', 'PREVIEW', false],
    ['ANIMATION', 'preview.mp4', 'video/quicktime', 'PREVIEW', false],
    ['IMAGE', 'fake.png', 'video/mp4', 'ORIGINAL', false],
    ['IMAGE', 'script.exe', 'image/png', 'ORIGINAL', false],
];
for (const [category, name, mime, purpose, allowed] of cases) {
    test(`${category} ${purpose}: ${name} (${mime}) is ${allowed ? 'allowed' : 'rejected'}`, () => {
        for (const implementation of [validation, frontend]) {
            assert.equal(implementation.assetFileError(category, name, mime, purpose) === null, allowed);
        }
        assert.equal(frontend.uploadAccept(category, purpose), validation.uploadAccept(category, purpose));
    });
}
function harness(category, files = []) {
    const asset = { id: 1, sellerId: 7, status: 'DRAFT', category, files, listingType: 'TRADITIONAL', pricePersonal: '0' };
    const effects = [];
    const prisma = {
        asset: { findUnique: async () => asset, update: async ({ data }) => { effects.push('update'); return { ...asset, ...data }; } },
        assetFile: { create: async ({ data }) => { effects.push('register'); return { id: 2, ...data }; } },
    };
    const exports = {};
    runInNewContext(controller, { exports, process: { env: { S3_BUCKET_NAME: 'bucket', AWS_REGION: 'region' } }, require: name =>
        name === '../lib/prisma' ? { prisma } : name === '../lib/assetSpecifications' ? validation : name === '../lib/s3' ? {
            getPresignedUploadUrl: async ({ key }) => { effects.push('sign'); return { url: 'signed', key, expiresIn: 60 }; },
        } : {} });
    const req = { user: { userId: 7 }, params: { id: '1' }, body: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; } };
    return { exports, req, res, effects };
}
test('upload signing and registration reject mismatches before storage/database effects', async () => {
    for (const handler of ['getUploadUrl', 'registerFile']) {
        const h = harness('IMAGE');
        h.req.body = { fileName: 'clip.mp4', key: 'assets/7/1/clip.mp4', fileType: 'video/mp4', fileSize: 20, purpose: 'ORIGINAL' };
        await h.exports[handler](h.req, h.res);
        assert.equal(h.res.statusCode, 400); assert.deepEqual(h.effects, []);
    }
});
test('ZIP signing and registration succeed only for model and animation originals', async () => {
    for (const category of Object.keys(validation.FORMAT_OPTIONS)) {
        for (const handler of ['getUploadUrl', 'registerFile']) {
            const h = harness(category);
            h.req.body = { fileName: 'bundle.zip', key: 'assets/7/1/bundle.zip', fileType: 'application/zip', fileSize: 20, purpose: 'ORIGINAL' };
            await h.exports[handler](h.req, h.res);
            assert.equal(h.res.statusCode, ['THREE_D_MODEL', 'ANIMATION'].includes(category) ? handler === 'registerFile' ? 201 : 200 : 400);
        }
    }
});
test('category changes and submission reject incompatible saved files', async () => {
    const files = [{ fileUrl: 'https://bucket.test/source.png', fileType: 'image/png', purpose: 'ORIGINAL', fileSize: 20 }];
    const h = harness('IMAGE', files); h.req.body = { category: 'FONT' };
    await h.exports.updateAsset(h.req, h.res);
    assert.equal(h.res.statusCode, 400); assert.deepEqual(h.effects, []);
    const oldDraft = harness('FONT', files);
    await oldDraft.exports.submitForReview(oldDraft.req, oldDraft.res);
    assert.equal(oldDraft.res.statusCode, 400); assert.deepEqual(oldDraft.effects, []);
});
