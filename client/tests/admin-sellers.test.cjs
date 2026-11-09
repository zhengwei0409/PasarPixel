const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminSellersPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const seller = (id, status = 'APPROVED') => ({ id, userId: id + 100, status, storeName: `Store ${String(id).padStart(2, '0')}`, user: { name: `Owner ${id}`, avatarUrl: null }, reviewedAt: '2026-11-01', createdAt: '2026-10-01', adminNote: status === 'REVOKED' ? 'Prior warnings' : null });
function harness({ active = [seller(1)], removed = [seller(2, 'REVOKED')], loading = false, loadError = false } = {}) {
    const state = [];
    let cursor = 0, buttons, tabs, inputs, selects, reason;
    const calls = [], refreshes = [];
    const mutation = () => ({ isPending: false, error: null, reset() { this.error = null; }, mutate(value, options) { calls.push({ value, options }); } });
    const revoke = mutation(), reinstate = mutation();
    const modules = {
        react: { ...React, useState: (initial) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = value; }]; }, useRef: (value) => { const index = cursor++; return state[index] ??= { current: value }; } },
        'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../components/ui/avatar': { Avatar: 'span', AvatarFallback: 'span', AvatarImage: 'img' },
        '../components/ui/button': { Button: ({ asChild, children, variant, size, ...props }) => { buttons.push({ children, ...props }); return asChild ? React.cloneElement(children, props) : React.createElement('button', props, children); } },
        '../components/ui/input': { Input: (props) => { inputs.push(props); return React.createElement('input', props); } },
        '../components/ui/select': { Select: (props) => { selects.push(props); return React.createElement('div', null, props.children); }, SelectContent: 'div', SelectItem: 'span', SelectTrigger: 'button', SelectValue: 'span' },
        '../components/ui/tabs': { Tabs: (props) => { tabs = props; return React.createElement('div', null, props.children); }, TabsList: ({ children }) => React.createElement('div', null, children), TabsContent: ({ children }) => React.createElement('div', null, children), TabsTrigger: 'button' },
        '../components/ui/dialog': { Dialog: ({ open, children }) => open ? React.createElement('div', null, children) : null, DialogContent: ({ children }) => React.createElement('div', null, children), DialogDescription: 'p', DialogFooter: 'div', DialogHeader: 'header', DialogTitle: 'h2' },
        '../components/ReasonPicker': { __esModule: true, default: (props) => { reason = props; return null; } },
        '../lib/adminReasons': { SELLER_REVOKE_REASONS: ['Prior warnings'] },
        '../lib/errors': { getErrorMessage: (_, fallback) => fallback },
        '../hooks/useSellerApplication': { useListApplications: (status) => ({ data: status === 'APPROVED' ? active : removed, isLoading: loading, isError: loadError, refetch: () => refreshes.push(status) }), useRevokeSeller: () => revoke, useReinstateSeller: () => reinstate },
    };
    const exports = {};
    runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; inputs = []; selects = []; reason = null; return renderToStaticMarkup(React.createElement(exports.default)); };
    return { render, calls, refreshes, revoke, reinstate,
        button: (label) => { const button = buttons.findLast((item) => item['aria-label'] === label || React.Children.toArray(item.children).filter((child) => typeof child === 'string').join('') === label); assert.ok(button, label); return button; },
        open: (label) => buttons.find((item) => item['aria-label'] === label).onClick({ currentTarget: { isConnected: true, focus() {} } }),
        filter: (value) => tabs.onValueChange(value),
        search: (value) => inputs[0].onChange({ target: { value } }),
        sort: (value) => selects[0].onValueChange(value),
        reason: (value) => reason.onChange(value),
    };
}

test('seller list filters by status and searches store and owner names', () => {
    const view = harness();
    assert.match(view.render(), /Store 01/);
    view.filter('REVOKED');
    assert.doesNotMatch(view.render(), /Store 01/);
    view.search('OWNER 2');
    assert.match(view.render(), /Store 02/);
    view.search('no match');
    assert.match(view.render(), /No sellers found/);
    view.button('Clear search').onClick();
    assert.match(view.render(), /Store 02/);
});

test('pagination resets after search and sorting uses store names', () => {
    const view = harness({ active: Array.from({ length: 12 }, (_, i) => seller(i + 1)), removed: [] });
    assert.match(view.render(), /1–10 of 12/);
    assert.equal(view.button('Previous page').disabled, true);
    view.button('Next page').onClick();
    assert.match(view.render(), /11–12 of 12/);
    view.search('Store 12');
    assert.match(view.render(), /1–1 of 1/);
    view.search('');
    view.sort('name');
    const html = view.render();
    assert.ok(html.indexOf('Store 01') < html.indexOf('Store 02'));
});

test('remove access requires a reason, sends the user ID, and closes only on success', () => {
    const view = harness();
    view.render(); view.open('Remove access for Store 01');
    assert.match(view.render(), /Their live listings will be hidden/);
    assert.equal(view.button('Remove access').disabled, true);
    view.reason('  Prior warnings  '); view.render();
    view.button('Remove access').onClick();
    assert.equal(view.calls[0].value.userId, 101);
    assert.equal(view.calls[0].value.adminNote, 'Prior warnings');
    view.revoke.error = new Error('failed');
    const html = view.render();
    assert.match(html, /Remove seller access\?/);
    assert.match(html, /Unable to update seller access/);
    view.calls[0].options.onSuccess();
    const success = view.render();
    assert.doesNotMatch(success, /Remove seller access\?/);
    assert.match(success, /seller access removed/);
});

test('restore access shows the removal reason and submits the correct user ID', () => {
    const view = harness();
    view.render(); view.open('Restore access for Store 02');
    const html = view.render();
    assert.match(html, /Prior warnings/);
    assert.match(html, /will be restored/);
    view.button('Restore access').onClick();
    assert.equal(view.calls[0].value, 102);
    view.calls[0].options.onSuccess();
    assert.match(view.render(), /seller access restored/);
});

test('pending access changes disable confirmation and cancel to prevent repeat requests', () => {
    const view = harness();
    view.render(); view.open('Remove access for Store 01'); view.render();
    view.reason('Prior warnings');
    view.revoke.isPending = true;
    assert.match(view.render(), /Removing/);
    assert.equal(view.button('Cancel').disabled, true);
    view.button('Removing…').onClick();
    assert.equal(view.calls.length, 0);
});

test('load failures show retry instead of an empty list, and retry refreshes both statuses', () => {
    const view = harness({ active: undefined, removed: undefined, loadError: true });
    const html = view.render();
    assert.match(html, /Unable to load sellers/);
    assert.doesNotMatch(html, /No sellers yet/);
    view.button('Try again').onClick();
    assert.deepEqual(view.refreshes, ['APPROVED', 'REVOKED']);
    assert.match(harness({ loading: true }).render(), /Loading sellers/);
    assert.match(harness({ active: [], removed: [] }).render(), /No sellers yet/);
});
