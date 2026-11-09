const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminUsersPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const account = (id) => ({ userId: id, name: `User ${id}`, email: `user${id}@example.com`, avatarUrl: null, createdAt: new Date(Date.UTC(2026, 10, id)).toISOString() });
function harness({ data = [account(1), account(2)], loading = false, loadError = false, missingData = false, authUser = { sub: '1' } } = {}) {
    const state = [];
    let cursor = 0, buttons, inputs, selects;
    const calls = [], refreshes = [];
    const mutation = { isPending: false, error: null, reset() { this.error = null; }, mutate(value, options) { calls.push({ value, options }); } };
    const modules = {
        react: { ...React, useState: (initial) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = value; }]; }, useRef: (value) => { const index = cursor++; return state[index] ??= { current: value }; } },
        'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../components/ui/button': { Button: ({ asChild, children, variant, size, ...props }) => { buttons.push({ children, ...props }); return asChild ? React.cloneElement(children, props) : React.createElement('button', props, children); } },
        '../components/ui/input': { Input: (props) => { inputs.push(props); return React.createElement('input', props); } },
        '../components/ui/select': { Select: (props) => { selects.push(props); return React.createElement('div', null, props.children); }, SelectContent: 'div', SelectItem: 'span', SelectTrigger: 'button', SelectValue: 'span' },
        '../components/ui/avatar': { Avatar: 'span', AvatarFallback: 'span', AvatarImage: 'img' },
        '../components/ui/dialog': { Dialog: ({ open, children }) => open ? React.createElement('div', null, children) : null, DialogContent: ({ children }) => React.createElement('div', null, children), DialogDescription: 'p', DialogFooter: 'div', DialogHeader: 'header', DialogTitle: 'h2' },
        '../lib/errors': { getErrorMessage: (_, fallback) => fallback },
        '../hooks/useUsers': { useUsers: () => ({ data: missingData ? undefined : data, isLoading: loading, error: loadError ? new Error('failed') : null, refetch: () => refreshes.push('users') }), useDeleteUser: () => mutation },
        '../hooks/useAuth': { useAuth: () => ({ user: authUser }) },
    };
    const exports = {};
    runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; inputs = []; selects = []; return renderToStaticMarkup(React.createElement(exports.default)); };
    return { render, calls, refreshes, mutation,
        button: (label) => { const button = buttons.findLast((item) => item['aria-label'] === label || React.Children.toArray(item.children).filter((child) => typeof child === 'string').join('') === label); assert.ok(button, label); return button; },
        open: (label) => buttons.find((item) => item['aria-label'] === label).onClick({ currentTarget: { isConnected: true, focus() {} } }),
        search: (value) => inputs[0].onChange({ target: { value } }),
        sort: (value) => selects[0].onValueChange(value),
        setAuth: (value) => { authUser = value; },
    };
}

test('users can be found by name, email and ID, and empty search can be cleared', () => {
    const view = harness();
    assert.match(view.render(), /User 2/);
    for (const query of ['USER 2', 'user2@EXAMPLE.com', '2']) {
        view.search(query);
        const html = view.render();
        assert.match(html, /User 2/);
        assert.doesNotMatch(html, /User 1/);
    }
    view.search('not found');
    assert.match(view.render(), /No users found/);
    view.button('Clear search').onClick();
    assert.match(view.render(), /User 1/);
});

test('pagination, newest/oldest/name sorting and result shrinkage keep pages valid', () => {
    const data = Array.from({ length: 12 }, (_, i) => account(i + 1));
    const view = harness({ data });
    const newest = view.render();
    assert.match(newest, /1–10 of 12/);
    assert.ok(newest.indexOf('User 12<') < newest.indexOf('User 11<'));
    view.button('Next page').onClick();
    assert.match(view.render(), /11–12 of 12/);
    data.splice(0, 2);
    assert.match(view.render(), /1–10 of 10/);
    view.search('user12@');
    assert.match(view.render(), /1–1 of 1/);
    view.search(''); view.sort('oldest');
    const oldest = view.render();
    assert.ok(oldest.indexOf('User 3<') < oldest.indexOf('User 4<'));
    view.sort('name');
    const byName = view.render();
    assert.ok(byName.indexOf('User 10<') < byName.indexOf('User 11<'));
});

test('the signed-in account is labeled and has no delete action', () => {
    const view = harness();
    const html = view.render();
    assert.match(html, />You</);
    assert.doesNotMatch(html, /aria-label="Delete user 1:/);
    assert.match(html, /aria-label="Delete user 2:/);
    const unknown = harness({ authUser: null }); unknown.render();
    assert.equal(unknown.button('Delete user 2: User 2').disabled, true);
});

test('deleting requires confirmation, sends the user ID and allows Cancel', () => {
    const view = harness();
    view.render(); view.open('Delete user 2: User 2');
    const html = view.render();
    assert.equal(view.calls.length, 0);
    assert.match(html, /This cannot be undone/);
    assert.match(html, /user2@example.com/);
    assert.match(html, /User #2/);
    view.button('Cancel').onClick();
    assert.doesNotMatch(view.render(), /Delete user\?/);
    assert.equal(view.calls.length, 0);
    view.open('Delete user 2: User 2'); view.render();
    view.button('Delete user').onClick();
    assert.equal(view.calls[0].value, 2);
});

test('failed deletion retains the selected account and closes only on success', () => {
    const view = harness();
    view.render(); view.open('Delete user 2: User 2'); view.render();
    view.button('Delete user').onClick();
    view.mutation.error = new Error('failed');
    const failed = view.render();
    assert.match(failed, /Unable to delete this user/);
    assert.match(failed, /Delete user\?/);
    assert.match(failed, /User #2/);
    view.calls[0].options.onSuccess();
    const success = view.render();
    assert.doesNotMatch(success, /Delete user\?/);
    assert.match(success, /User 2: account deleted/);
});

test('pending deletion blocks repeated requests and live auth changes protect the current user', () => {
    const view = harness();
    view.render(); view.open('Delete user 2: User 2');
    view.mutation.isPending = true; view.render();
    assert.equal(view.button('Cancel').disabled, true);
    assert.equal(view.button('Deleting…').disabled, true);
    view.button('Deleting…').onClick();
    assert.equal(view.calls.length, 0);
    view.mutation.isPending = false;
    view.setAuth({ sub: '2' }); view.render();
    assert.equal(view.button('Delete user').disabled, true);
    view.button('Delete user').onClick();
    assert.equal(view.calls.length, 0);
});

test('loading, failed loading and an empty user list show separate states', () => {
    const view = harness({ loadError: true, missingData: true });
    assert.match(view.render(), /Unable to load users/);
    view.button('Try again').onClick();
    assert.deepEqual(view.refreshes, ['users']);
    assert.match(harness({ loading: true }).render(), /Loading users/);
    assert.match(harness({ missingData: true }).render(), /Unable to load users/);
    assert.match(harness({ data: [] }).render(), /No users yet/);
    const unnamed = account(2); unnamed.name = ''; unnamed.email = null;
    const fallback = harness({ data: [unnamed] }).render();
    assert.match(fallback, /Unnamed user/);
    assert.match(fallback, /No email/);
    assert.doesNotMatch(fallback, /undefined/);
});
