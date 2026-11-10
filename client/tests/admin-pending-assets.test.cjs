const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminAssetReviewPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const asset = (id, overrides = {}) => ({ id, title: `Asset ${String(id).padStart(2, '0')}`, description: `Description ${id}`, category: 'THREE_D_MODEL', listingType: id % 2 ? 'TRADITIONAL' : 'BLOCKCHAIN', status: 'PENDING_REVIEW', seller: { userId: id + 100, name: `Seller ${id}`, email: `seller${id}@example.com` }, _count: { files: id }, isAiGenerated: id === 1, createdAt: new Date(Date.UTC(2026, 10, id)).toISOString(), ...overrides });
function harness({ data = [asset(1), asset(2, { category: 'IMAGE' })], loading = false, loadError = false, missingData = false, fetching = false } = {}) {
    const state = [];
    let cursor = 0, buttons, tabs, input, selects;
    const refreshes = [];
    const modules = {
        react: { ...React, useState: (initial) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = value; }]; } },
        'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../components/ui/button': { Button: ({ asChild, children, variant, size, ...props }) => { buttons.push({ children, ...props }); return asChild ? React.cloneElement(children, props) : React.createElement('button', props, children); } },
        '../components/ui/input': { Input: (props) => { input = props; return React.createElement('input', props); } },
        '../components/ui/select': { Select: (props) => { selects.push(props); return React.createElement('div', null, props.children); }, SelectContent: 'div', SelectItem: 'span', SelectTrigger: 'button', SelectValue: 'span' },
        '../components/ui/tabs': { Tabs: (props) => { tabs = props; return React.createElement('div', null, props.children); }, TabsList: ({ children }) => React.createElement('div', null, children), TabsContent: ({ children }) => React.createElement('div', null, children), TabsTrigger: 'button' },
        '../hooks/useAsset': { usePendingReviewAssets: () => ({ data: missingData ? undefined : data, isLoading: loading, error: loadError ? new Error('failed') : null, isFetching: fetching, refetch: () => refreshes.push('assets') }) },
    };
    const exports = {};
    runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; selects = []; return renderToStaticMarkup(React.createElement(exports.default)); };
    return { render, refreshes,
        button: (label) => { const found = buttons.findLast((item) => item['aria-label'] === label || item.children === label); assert.ok(found, label); return found; },
        listing: (value) => tabs.onValueChange(value),
        category: (value) => selects[0].onValueChange(value),
        sort: (value) => selects[1].onValueChange(value),
        search: (value) => input.onChange({ target: { value } }),
    };
}

test('pending asset search matches title, seller name, email, description and ID', () => {
    const view = harness(); view.render();
    for (const query of ['ASSET 02', 'SELLER 2', 'seller2@EXAMPLE.com', 'Description 2', '2']) {
        view.search(query);
        const html = view.render();
        assert.match(html, /Asset 02/);
        assert.doesNotMatch(html, /Asset 01/);
    }
});

test('listing and category filters combine, and Clear filters resets the whole view', () => {
    const view = harness(); view.render();
    view.listing('BLOCKCHAIN');
    assert.doesNotMatch(view.render(), /Asset 01/);
    view.category('IMAGE');
    assert.match(view.render(), /Asset 02/);
    view.category('FONT');
    assert.match(view.render(), /No matching assets/);
    view.button('Clear filters').onClick();
    const reset = view.render();
    assert.match(reset, /Asset 01/);
    assert.match(reset, /Asset 02/);
});

test('oldest assets appear first by default and sorting supports newest and title', () => {
    const view = harness({ data: [asset(3, { title: 'Alpha' }), asset(1, { title: 'Zulu' }), asset(2, { title: 'Middle' })] });
    let html = view.render();
    assert.ok(html.indexOf('Zulu') < html.indexOf('Middle'));
    view.sort('newest'); html = view.render();
    assert.ok(html.indexOf('Alpha') < html.indexOf('Middle'));
    view.sort('name'); html = view.render();
    assert.ok(html.indexOf('Alpha') < html.indexOf('Middle'));
    assert.ok(html.indexOf('Middle') < html.indexOf('Zulu'));
});

test('pagination clamps when the queue shrinks and resets after search/category/type changes', () => {
    const data = Array.from({ length: 12 }, (_, i) => asset(i + 1));
    const view = harness({ data });
    assert.match(view.render(), /1–10 of 12/);
    assert.equal(view.button('Previous page').disabled, true);
    view.button('Next page').onClick();
    assert.match(view.render(), /11–12 of 12/);
    data.splice(0, 2);
    assert.match(view.render(), /1–10 of 10/);
    view.search('Asset 12');
    assert.match(view.render(), /1–1 of 1/);
    view.search(''); view.listing('TRADITIONAL');
    assert.match(view.render(), /1–5 of 5/);
    view.category('FONT');
    assert.match(view.render(), /0 assets/);
});

test('Review opens the existing asset inspection route and retains AI/file information', () => {
    const html = harness().render();
    assert.match(html, /href="\/admin\/assets\/1\/review"/);
    assert.match(html, /aria-label="Review Asset 01"/);
    assert.match(html, /href="\/admin\/assets"/);
    assert.match(html, /AI-generated/);
    assert.match(html, /1 file</);
    assert.match(html, /2 files</);
});

test('loading, failed loading, empty queue and empty filter results stay distinct', () => {
    const failed = harness({ missingData: true, loadError: true });
    assert.match(failed.render(), /Unable to load pending assets/);
    failed.button('Try again').onClick();
    assert.deepEqual(failed.refreshes, ['assets']);
    const refreshing = harness({ loadError: true, fetching: true }); refreshing.render();
    assert.equal(refreshing.button('Try again').disabled, true);
    assert.match(harness({ loading: true }).render(), /Loading pending assets/);
    assert.match(harness({ missingData: true }).render(), /Unable to load pending assets/);
    assert.match(harness({ data: [] }).render(), /No assets awaiting review/);
    const filtered = harness(); filtered.render(); filtered.search('not found');
    assert.match(filtered.render(), /No matching assets/);
});
