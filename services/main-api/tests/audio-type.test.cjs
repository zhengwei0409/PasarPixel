const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/asset.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

async function invoke(handler, body, asset = { id: 1, sellerId: 7, status: 'DRAFT', category: 'SOUND_EFFECT', audioType: 'MUSIC' }) {
    let saved;
    const prisma = {
        userProfile: { findUnique: async () => ({ userId: 7 }) },
        asset: {
            findUnique: async () => asset,
            create: async ({ data }) => { saved = data; return data; },
            update: async ({ data }) => { saved = data; return data; },
        },
    };
    const exports = {};
    runInNewContext(code, { exports, require: name => name === '../lib/prisma' ? { prisma } : {} });
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await exports[handler]({ user: { userId: 7 }, params: { id: '1' }, body }, res);
    return { saved, res };
}

test('audio uploads save the selected type and require a valid choice', async () => {
    const body = { title: 'Track', category: 'SOUND_EFFECT', listingType: 'TRADITIONAL' };
    for (const audioType of ['MUSIC', 'SOUND_EFFECT']) {
        const { saved, res } = await invoke('createAsset', { ...body, audioType });
        assert.equal(res.statusCode, 201);
        assert.equal(saved.audioType, audioType);
    }
    for (const audioType of [undefined, null, 'invalid', 4]) {
        const { saved, res } = await invoke('createAsset', { ...body, audioType });
        assert.equal(res.statusCode, 400);
        assert.equal(saved, undefined);
    }
});

test('non-audio assets cannot be assigned an audio type', async () => {
    const { saved, res } = await invoke('createAsset', { title: 'Image', category: 'IMAGE', listingType: 'TRADITIONAL', audioType: 'MUSIC' });
    assert.equal(res.statusCode, 400);
    assert.equal(saved, undefined);
});

test('editing audio updates its type or preserves it when omitted', async () => {
    const changed = await invoke('updateAsset', { audioType: 'SOUND_EFFECT' });
    assert.equal(changed.saved.audioType, 'SOUND_EFFECT');
    const preserved = await invoke('updateAsset', { title: 'Renamed' });
    assert.equal(preserved.res.statusCode, 200);
    assert.equal(preserved.saved.audioType, undefined);
    const invalid = await invoke('updateAsset', { audioType: null });
    assert.equal(invalid.res.statusCode, 400);
});

test('changing category clears audio classification and requires a choice when switching to audio', async () => {
    const changed = await invoke('updateAsset', { category: 'IMAGE' });
    assert.equal(changed.saved.audioType, null);
    const image = { id: 1, sellerId: 7, status: 'DRAFT', category: 'IMAGE', audioType: null };
    const missing = await invoke('updateAsset', { category: 'SOUND_EFFECT' }, image);
    assert.equal(missing.res.statusCode, 400);
    const specified = await invoke('updateAsset', { category: 'SOUND_EFFECT', audioType: 'MUSIC' }, image);
    assert.equal(specified.saved.audioType, 'MUSIC');
});
