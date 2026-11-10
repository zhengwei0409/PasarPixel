const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/controllers/user.controller.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture({ missing = false, failAudit = false } = {}) {
    const calls = [];
    const profile = { assets: [{ id: 20, files: [{ fileUrl: 'file-key' }] }], avatarUrl: 'avatar-key', store: null };
    const tx = new Proxy({}, { get: (_, model) => new Proxy({}, { get: (_, operation) => async (query) => {
        calls.push({ model, operation, query });
        if (model === 'activityLog' && operation === 'create' && failAudit) throw new Error('audit failure');
    } }) });
    const prisma = {
        userProfile: { findUnique: async (query) => { calls.push({ lookup: query }); return missing ? null : profile; } },
        $transaction: async (callback) => { calls.push({ transaction: true }); await callback(tx); },
    };
    const modules = {
        '../lib/prisma': { prisma },
        '../lib/s3': { extractKeyFromUrl: (url) => url, deleteObject: async (key) => calls.push({ file: key }) },
        '../lib/publisher': { publishUserDeleted: async (event) => calls.push({ published: event }) },
    };
    const exports = {};
    runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const invoke = async (body, { id = '2', adminId = 9 } = {}) => {
        const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, send() { this.sent = true; } };
        await exports.deleteUser({ params: { userId: id }, body, user: { userId: adminId } }, response);
        return response;
    };
    return { calls, invoke };
}

test('missing, blank and non-string reasons are rejected before any deletion side effect', async () => {
    for (const body of [undefined, {}, { reason: null }, { reason: 12 }, { reason: {} }, { reason: '' }, { reason: ' \n\t ' }]) {
        const view = fixture();
        const response = await view.invoke(body);
        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /reason is required/);
        assert.equal(view.calls.length, 0);
    }
});

test('self-deletion and invalid user IDs are rejected before any side effect', async () => {
    for (const id of ['9', '0', '-1', '2abc', '1.5', '9007199254740992']) {
        const view = fixture();
        const response = await view.invoke({ reason: 'Spam or scam activity' }, { id });
        assert.equal(response.statusCode, 400);
        assert.equal(view.calls.length, 0);
    }
});

test('valid preset and custom reasons are recorded against the admin in the deletion transaction', async () => {
    for (const reason of ['  Spam or scam activity  ', 'Duplicate account confirmed by owner']) {
        const view = fixture();
        const response = await view.invoke({ reason });
        assert.equal(response.statusCode, 204);
        const audit = view.calls.find((call) => call.model === 'activityLog' && call.operation === 'create');
        assert.equal(audit.query.data.userId, 9);
        assert.equal(audit.query.data.targetType, 'USER');
        assert.equal(audit.query.data.targetId, 2);
        assert.equal(audit.query.data.action, `DELETE_USER: ${reason.trim()}`);
        assert.ok(view.calls.findIndex((call) => call.transaction) < view.calls.indexOf(audit));
        assert.ok(view.calls.indexOf(audit) < view.calls.findIndex((call) => call.published));
        const removedActivity = view.calls.find((call) => call.model === 'activityLog' && call.operation === 'deleteMany');
        assert.equal(removedActivity.query.where.userId, 2);
        assert.equal(view.calls.find((call) => call.published).published.userId, 2);
    }
});

test('a missing account does not delete files, create audit records or publish an event', async () => {
    const view = fixture({ missing: true });
    const response = await view.invoke({ reason: 'User requested account deletion' });
    assert.equal(response.statusCode, 404);
    assert.equal(view.calls.length, 1);
    assert.ok(view.calls[0].lookup);
});

test('an audit write failure fails the transaction and does not publish a successful deletion', async () => {
    const view = fixture({ failAudit: true });
    await assert.rejects(() => view.invoke({ reason: 'Spam or scam activity' }), /audit failure/);
    assert.equal(view.calls.some((call) => call.published), false);
});
