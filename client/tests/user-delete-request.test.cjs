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
        assert.equal(name, '@tanstack/react-query');
        return { useMutation: (options) => options, useQueryClient: () => ({ invalidateQueries: (query) => invalidations.push(query) }) };
    } });
    const mutation = hooks.useDeleteUser();
    await mutation.mutationFn({ userId: 42, reason: 'Spam or scam activity' });
    assert.equal(requests[0].url, '/users/42');
    assert.equal(requests[0].config.data.reason, 'Spam or scam activity');
    mutation.onSuccess();
    assert.equal(invalidations[0].queryKey[0], 'users');
});
