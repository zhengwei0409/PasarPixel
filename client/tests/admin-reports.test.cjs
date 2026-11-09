const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminReportsPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const report = (id, status = 'PENDING') => ({ id, status, reason: `Report reason ${id}`, createdAt: new Date(Date.UTC(2026, 10, id)).toISOString(), updatedAt: '2026-11-01', asset: { id: id + 100, title: `Listing ${id}`, status: 'PUBLISHED', sellerId: 50 }, reporter: { userId: id + 200, name: `Reporter ${id}`, email: null } });
function harness({ data = [report(1), report(2, 'DISMISSED')], loading = false, loadError = false, missingData = false } = {}) {
    const state = [];
    let cursor = 0, buttons, tabs, inputs, selects, reason;
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
        '../components/ui/tabs': { Tabs: (props) => { tabs = props; return React.createElement('div', null, props.children); }, TabsList: ({ children }) => React.createElement('div', null, children), TabsContent: ({ children }) => React.createElement('div', null, children), TabsTrigger: 'button' },
        '../components/ui/dialog': { Dialog: ({ open, children }) => open ? React.createElement('div', null, children) : null, DialogContent: ({ children }) => React.createElement('div', null, children), DialogDescription: 'p', DialogFooter: 'div', DialogHeader: 'header', DialogTitle: 'h2' },
        '../components/ReasonPicker': { __esModule: true, default: (props) => { reason = props; return null; } },
        '../lib/reportReasons': { ASSET_TAKEDOWN_REASONS: ['Copyright infringement'] },
        '../lib/errors': { getErrorMessage: (_, fallback) => fallback },
        '../hooks/useReport': { useReports: () => ({ data: missingData ? undefined : data, isLoading: loading, error: loadError ? new Error('failed') : null, refetch: () => refreshes.push('reports') }), useResolveReport: () => mutation },
    };
    const exports = {};
    runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; inputs = []; selects = []; reason = null; return renderToStaticMarkup(React.createElement(exports.default)); };
    return { render, calls, refreshes, mutation,
        button: (label) => { const button = buttons.findLast((item) => item['aria-label'] === label || React.Children.toArray(item.children).filter((child) => typeof child === 'string').join('') === label); assert.ok(button, label); return button; },
        open: (label) => buttons.find((item) => item['aria-label'] === label).onClick({ currentTarget: { isConnected: true, focus() {} } }),
        filter: (value) => tabs.onValueChange(value),
        search: (value) => inputs[0].onChange({ target: { value } }),
        sort: (value) => selects[0].onValueChange(value),
        reason: (value) => reason.onChange(value),
    };
}

test('reports default to pending and support status, reporter, reason and ID searches', () => {
    const view = harness();
    const initial = view.render();
    assert.match(initial, /Listing 1/);
    assert.doesNotMatch(initial, /Listing 2/);
    view.filter('RESOLVED');
    assert.match(view.render(), /Listing 2/);
    view.filter('ALL');
    for (const query of ['REPORTER 2', 'reason 2', '2']) {
        view.search(query);
        const html = view.render();
        assert.match(html, /Listing 2/);
        assert.doesNotMatch(html, /Listing 1/);
    }
    view.search('not found');
    assert.match(view.render(), /No reports found/);
    view.button('Clear search').onClick();
    assert.match(view.render(), /Listing 1/);
});

test('pagination and sort reset correctly when a search changes the result count', () => {
    const view = harness({ data: Array.from({ length: 12 }, (_, i) => report(i + 1)) });
    assert.match(view.render(), /1–10 of 12/);
    assert.equal(view.button('Previous page').disabled, true);
    view.button('Next page').onClick();
    assert.match(view.render(), /11–12 of 12/);
    view.search('Listing 12');
    assert.match(view.render(), /1–1 of 1/);
    view.search(''); view.sort('oldest');
    const html = view.render();
    assert.ok(html.indexOf('Listing 1<') < html.indexOf('Listing 2<'));
});

test('take down requires review and a reason, preserves failure state, and closes on success', () => {
    const view = harness();
    view.render(); view.open('Review report 1');
    assert.match(view.render(), /Report reason 1/);
    view.button('Take down listing').onClick();
    assert.equal(view.calls.length, 0);
    view.render();
    assert.equal(view.button('Take down listing').disabled, true);
    view.reason('  Copyright infringement  '); view.render();
    view.button('Take down listing').onClick();
    assert.equal(view.calls[0].value.reportId, 1);
    assert.equal(view.calls[0].value.action, 'take_down');
    assert.equal(view.calls[0].value.reason, 'Copyright infringement');
    view.mutation.error = new Error('failed');
    const failed = view.render();
    assert.match(failed, /Take down this listing\?/);
    assert.match(failed, /Unable to resolve this report/);
    view.calls[0].options.onSuccess();
    const success = view.render();
    assert.doesNotMatch(success, /Take down this listing\?/);
    assert.match(success, /Report #1 resolved. Listing taken down./);
});

test('returning to review clears the reason before a new take down confirmation', () => {
    const view = harness();
    view.render(); view.open('Review report 1'); view.render();
    view.button('Take down listing').onClick(); view.render();
    view.reason('Copyright infringement'); view.render();
    assert.equal(view.button('Take down listing').disabled, false);
    view.button('Back').onClick(); view.render();
    view.button('Take down listing').onClick(); view.render();
    assert.equal(view.button('Take down listing').disabled, true);
});

test('dismiss asks for confirmation and sends no take down reason', () => {
    const view = harness();
    view.render(); view.open('Review report 1'); view.render();
    view.button('Dismiss report').onClick();
    assert.equal(view.calls.length, 0);
    assert.match(view.render(), /without changing the listing/);
    view.button('Dismiss report').onClick();
    assert.equal(view.calls[0].value.action, 'dismiss');
    assert.equal(view.calls[0].value.reportId, 1);
    assert.equal('reason' in view.calls[0].value, false);
    view.calls[0].options.onSuccess();
    assert.match(view.render(), /Report #1 dismissed/);
});

test('resolved reports cannot be resolved again and unavailable listings cannot be taken down', () => {
    const view = harness();
    view.render(); view.filter('RESOLVED'); view.render(); view.open('View report 2');
    const resolved = view.render();
    assert.doesNotMatch(resolved, /Dismiss report|Take down listing/);
    assert.match(resolved, /Close/);
    const missing = report(3); missing.asset = { id: 103, title: null, status: null, sellerId: null }; missing.reporter.name = null;
    const unavailable = harness({ data: [missing] });
    assert.match(unavailable.render(), /Listing unavailable/);
    unavailable.open('Review report 3');
    const html = unavailable.render();
    assert.match(html, /Unknown reporter/);
    assert.doesNotMatch(html, /href="\/admin\/assets\//);
    assert.equal(unavailable.button('Take down listing').disabled, true);
    assert.equal(unavailable.button('Dismiss report').disabled, undefined);
});

test('pending resolution blocks repeat submissions and disables Back', () => {
    const view = harness();
    view.render(); view.open('Review report 1'); view.render();
    view.button('Dismiss report').onClick();
    view.mutation.isPending = true; view.render();
    assert.equal(view.button('Back').disabled, true);
    view.button('Dismissing…').onClick();
    assert.equal(view.calls.length, 0);
});

test('loading, retry, unavailable data and empty queues have separate states', () => {
    const view = harness({ loadError: true, missingData: true });
    const html = view.render();
    assert.match(html, /Unable to load reports/);
    assert.doesNotMatch(html, /No pending reports/);
    view.button('Try again').onClick();
    assert.deepEqual(view.refreshes, ['reports']);
    assert.match(harness({ loading: true }).render(), /Loading reports/);
    assert.match(harness({ missingData: true }).render(), /Unable to load reports/);
    assert.match(harness({ data: [] }).render(), /No pending reports/);
});
