const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { runInNewContext } = require('node:vm');
const { PrismaClient } = require('@prisma/client');
const ts = require('typescript');
const sharp = require('sharp');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a local disposable PostgreSQL database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('A local test database is required');
const schema = `snapshot_test_${randomBytes(8).toString('hex')}`;
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const objects = new Map();
const hashes = require('../dist/services/main-api/src/lib/nftSnapshot');
const handlers = {};
let asset;
runInNewContext(ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/nftSnapshot.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, {
    exports: handlers, Buffer, process,
    require: name => {
        if (name === '../lib/prisma') return { prisma: db };
        if (name === '../lib/nftSnapshot') return hashes;
        if (name === '../lib/nftDownloadName') return require('../dist/services/main-api/src/lib/nftDownloadName');
        if (name === '../lib/s3') return {
            extractKeyFromUrl: url => new URL(url).pathname.slice(1),
            getObjectBuffer: async key => { if (!objects.has(key)) throw new Error('Object not found'); return objects.get(key); },
            putNftOriginalSnapshot: async (hash, bytes) => { const key = `nft-originals/${hash}`; objects.set(key, bytes); return key; },
        };
        return require(name);
    },
});
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; },
    set(headers) { this.headers = headers; }, send(body) { this.body = body; }, end() {} });
async function snapshot(userId = 77) {
    const res = response();
    await handlers.getMintSnapshot({ params: { id: String(asset.id) }, user: { userId } }, res);
    return res;
}
before(async () => {
    execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
        cwd: join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe',
    });
    await db.userProfile.create({ data: { userId: 77, name: 'Seller' } });
    asset = await db.asset.create({ data: { sellerId: 77, title: 'Snapshot asset', category: 'IMAGE', listingType: 'BLOCKCHAIN', status: 'PUBLISHED', priceSolPersonal: '0.01' } });
    const original = Buffer.from('private original bytes');
    objects.set('private/original.bin', original);
    await db.assetFile.create({ data: { assetId: asset.id, fileType: 'image/png', fileUrl: 'https://private.example/private/original.bin', fileSize: original.length,
        previewUrl: 'https://private.example/unused-preview.png' } });
    // Neither image URL has a storage fixture: snapshotting must use the logo
    // without reading the listing's cover or generated image preview.
    await db.assetFile.create({ data: { assetId: asset.id, purpose: 'PREVIEW', fileType: 'image/png',
        fileUrl: 'https://private.example/unused-cover.png', fileSize: 10 } });
});
after(async () => { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.$disconnect(); });

test('only the owning seller can snapshot an approved available blockchain listing', async () => {
    assert.equal((await snapshot(88)).code, 404);
    await db.asset.update({ where: { id: asset.id }, data: { status: 'PENDING_REVIEW' } });
    assert.equal((await snapshot()).code, 409);
    await db.asset.update({ where: { id: asset.id }, data: { status: 'PUBLISHED' } });
});

test('snapshot hashes real original bytes, stores private copies and serves immutable public data', async () => {
    const result = await snapshot();
    assert.equal(result.code, 200);
    const row = await db.assetMintSnapshot.findUniqueOrThrow({ where: { assetId: asset.id } });
    assert.equal(row.originals[0].name, 'original.png');
    const manifest = await db.nftPublicObject.findUniqueOrThrow({ where: { hash: row.manifestHash } });
    const content = JSON.parse(Buffer.from(manifest.body).toString());
    const expected = createHash('sha256').update('private original bytes').digest('hex');
    assert.equal(content.files[0].hash, expected);
    assert.equal(objects.get(`nft-originals/${expected}`).toString(), 'private original bytes');
    assert.ok(!JSON.stringify(result.body).includes('original.bin'));
    assert.ok(!Buffer.from(manifest.body).toString().includes('private.example'));
    const preview = await db.nftPublicObject.findUniqueOrThrow({ where: { hash: row.previewHash } });
    assert.equal((await sharp(Buffer.from(preview.body)).metadata()).format, 'png');
    // Even image listings with covers use the same immutable logo snapshot.
    const logo = await sharp(join(__dirname, '../assets/pasarpixel-logo.jpeg')).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    assert.equal(hashes.sha256(Buffer.from(preview.body)), hashes.sha256(logo));
    const res = response();
    await handlers.getNftContent({ params: { hash: row.manifestHash } }, res);
    assert.equal(res.headers['Cache-Control'], 'public, max-age=31536000, immutable');
    assert.equal(hashes.sha256(res.body), row.manifestHash);
});

test('repeated and concurrent snapshot requests return the same immutable reference', async () => {
    const results = await Promise.all([snapshot(), snapshot()]);
    assert.equal(results[0].body.listingRef, results[1].body.listingRef);
    assert.equal(await db.assetMintSnapshot.count({ where: { assetId: asset.id } }), 1);
    const first = results[0].body.manifestHash;
    objects.set('private/original.bin', Buffer.from('changed bytes'));
    assert.equal((await snapshot()).body.manifestHash, first);
});

test('database guards reject overwriting or deleting public content and asset snapshots', async () => {
    const row = await db.assetMintSnapshot.findUniqueOrThrow({ where: { assetId: asset.id } });
    await assert.rejects(db.nftPublicObject.update({ where: { hash: row.manifestHash }, data: { body: Uint8Array.from([1]) } }), /immutable/);
    await assert.rejects(db.nftPublicObject.delete({ where: { hash: row.previewHash } }), /immutable/);
    await assert.rejects(db.assetMintSnapshot.update({ where: { assetId: asset.id }, data: { title: 'Replaced' } }), /immutable/);
    await assert.rejects(db.assetMintSnapshot.delete({ where: { assetId: asset.id } }), /immutable/);
});

test('moderation blocks future minting while preserving already published snapshot objects', async () => {
    await db.asset.update({ where: { id: asset.id }, data: { hiddenByRevoke: true } });
    assert.equal((await snapshot()).code, 409);
    const res = response();
    await handlers.getMintEligibility({ params: { id: String(asset.id) } }, res);
    assert.equal(res.code, 404);
    assert.equal(await db.assetMintSnapshot.count({ where: { assetId: asset.id } }), 1);
});
