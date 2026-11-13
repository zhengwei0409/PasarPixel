const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const compile = (path) => ts.transpileModule(readFileSync(join(__dirname, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

test('the delete mutation sends the selected reason in the DELETE request body', async () => {
    const requests = [], invalidations = [];
    const apiClient = { delete: async (url, config) => requests.push({ url, config }) };
    const services = {};
    runInNewContext(compile('../src/services/userService.ts'), { exports: services, require: (name) => {
        assert.equal(name, '../lib/apiClient'); return { __esModule: true, default: apiClient };
    } });
    const hooks = {};
    runInNewContext(compile('../src/hooks/useUsers.ts'), { exports: hooks, require: (name) => {
        if (name === '../services/userService') return services;
        if (name === 'axios') return require('axios');
        assert.equal(name, '@tanstack/react-query');
        return { useMutation: (options) => options, useQueryClient: () => ({
            invalidateQueries: (query) => invalidations.push(query),
            removeQueries: () => {},
        }) };
    } });
    const mutation = hooks.useDeleteUser();
    await mutation.mutationFn({ userId: 42, reason: 'Spam or scam activity' });
    assert.equal(requests[0].url, '/users/42');
    assert.equal(requests[0].config.data.reason, 'Spam or scam activity');
    mutation.onSuccess(undefined, { userId: 42 });
    assert.equal(invalidations[0].queryKey[0], 'users');
});

test('suspension sends the reason and updates the account in both user views', async () => {
    const requests = [];
    const users = [{ userId: 42, status: 'ACTIVE', hasProfile: true }, { userId: 5, status: 'ACTIVE' }];
    let list = users;
    let detail = { account: { userId: 42, status: 'ACTIVE', twoFactorEnabled: true }, profile: { name: 'Buyer' } };
    let invalidations = 0;
    const apiClient = { patch: async (url, body) => {
        requests.push(JSON.parse(JSON.stringify({ url, body })));
        return { data: { userId: 42, status: body.suspended ? 'SUSPENDED' : 'TWO_FACTOR_LOCKED' } };
    } };
    const services = {};
    runInNewContext(compile('../src/services/userService.ts'), {
        exports: services, require: () => ({ __esModule: true, default: apiClient }),
    });
    const hooks = {};
    runInNewContext(compile('../src/hooks/useUsers.ts'), { exports: hooks, require(name) {
        if (name === '../services/userService') return services;
        if (name === 'axios') return require('axios');
        assert.equal(name, '@tanstack/react-query');
        return { useMutation: (options) => options, useQueryClient: () => ({
            setQueryData: (key, update) => { assert.deepEqual([...key], ['users']); list = update(list); },
            setQueriesData: ({ queryKey }, update) => { assert.deepEqual([...queryKey], ['users', 42]); detail = update(detail); },
            invalidateQueries: () => { invalidations++; },
        }) };
    } });
    const mutation = hooks.useUpdateAccountSuspension();
    mutation.onSuccess(await mutation.mutationFn({ userId: 42, suspended: true, reason: 'Policy violation' }));
    assert.equal(list[0].status, 'SUSPENDED');
    assert.equal(detail.account.status, 'SUSPENDED');
    mutation.onSuccess(await mutation.mutationFn({ userId: 42, suspended: false, reason: 'Appeal accepted' }));
    assert.equal(list[0].status, 'TWO_FACTOR_LOCKED');
    assert.equal(list[0].hasProfile, true);
    assert.equal(list[1], users[1]);
    assert.equal(detail.account.status, 'TWO_FACTOR_LOCKED');
    assert.equal(detail.account.twoFactorEnabled, true);
    assert.equal(detail.profile.name, 'Buyer');
    assert.equal(invalidations, 2);
    assert.deepEqual(requests, [
        { url: '/auth/admin/accounts/42/suspension', body: { suspended: true, reason: 'Policy violation' } },
        { url: '/auth/admin/accounts/42/suspension', body: { suspended: false, reason: 'Appeal accepted' } },
    ]);
});
