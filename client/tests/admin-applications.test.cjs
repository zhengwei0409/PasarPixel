const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminApplicationsPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const application = (id, status = 'PENDING') => ({ id, userId: id + 100, storeName: `Store ${String(id).padStart(2, '0')}`, status, reason: `Original illustration and design ${id}`, user: { name: `Applicant ${id}`, avatarUrl: null }, fullName: `Full name ${id}`, portfolioLink: 'https://example.com/portfolio', idDocumentKey: 'private-id.pdf', adminNote: status === 'REJECTED' ? 'Incomplete application' : null, createdAt: new Date(Date.UTC(2026, 10, id)).toISOString() });
function harness({ data = [application(1), application(2, 'APPROVED')], loading = false, loadError = false, missingData = false } = {}) {
    const state = [];
    let cursor = 0, buttons, tabs, inputs, selects, reason;
    const calls = [], refreshes = [], queryStatuses = [];
    const mutation = (name) => ({ isPending: false, error: null, reset() { this.error = null; }, mutate(value, options) { calls.push({ name, value, options }); } });
    const approve = mutation('approve'), reject = mutation('reject');
    const modules = {
        react: { ...React, useState: (initial) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = value; }]; }, useRef: (value) => { const index = cursor++; return state[index] ??= { current: value }; } },
        'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../components/ui/button': { Button: ({ asChild, children, variant, size, ...props }) => { buttons.push({ children, ...props }); return asChild ? React.cloneElement(children, props) : React.createElement('button', props, children); } },
        '../components/ui/input': { Input: (props) => { inputs.push(props); return React.createElement('input', props); } },
        '../components/ui/select': { Select: (props) => { selects.push(props); return React.createElement('div', null, props.children); }, SelectContent: 'div', SelectItem: 'span', SelectTrigger: 'button', SelectValue: 'span' },
        '../components/ui/tabs': { Tabs: (props) => { tabs = props; return React.createElement('div', null, props.children); }, TabsList: ({ children }) => React.createElement('div', null, children), TabsContent: ({ children }) => React.createElement('div', null, children), TabsTrigger: 'button' },
        '../components/ui/avatar': { Avatar: 'span', AvatarFallback: 'span', AvatarImage: 'img' },
        '../components/ui/dialog': { Dialog: ({ open, children }) => open ? React.createElement('div', null, children) : null, DialogContent: ({ children }) => React.createElement('div', null, children), DialogDescription: 'p', DialogFooter: 'div', DialogHeader: 'header', DialogTitle: 'h2' },
        '../components/ReasonPicker': { __esModule: true, default: (props) => { reason = props; return null; } },
        '../lib/adminReasons': { APPLICATION_REJECT_REASONS: ['Incomplete or inaccurate application details'] },
        '../lib/errors': { getErrorMessage: (_, fallback) => fallback },
        '../hooks/useSellerApplication': { useListApplications: (status) => { queryStatuses.push(status); return { data: missingData ? undefined : data, isLoading: loading, error: loadError ? new Error('failed') : null, refetch: () => refreshes.push('applications') }; }, useApproveApplication: () => approve, useRejectApplication: () => reject },
    };
    const exports = {};
    runInNewContext(code, { exports, URL, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; inputs = []; selects = []; reason = null; return renderToStaticMarkup(React.createElement(exports.default)); };
    return { render, calls, refreshes, queryStatuses, approve, reject,
        button: (label) => { const button = buttons.findLast((item) => item['aria-label'] === label || React.Children.toArray(item.children).filter((child) => typeof child === 'string').join('') === label); assert.ok(button, label); return button; },
        open: (label) => buttons.find((item) => item['aria-label'] === label).onClick({ currentTarget: { isConnected: true, focus() {} } }),
        filter: (value) => tabs.onValueChange(value),
        search: (value) => inputs[0].onChange({ target: { value } }),
        sort: (value) => selects[0].onValueChange(value),
        reason: (value) => reason.onChange(value),
    };
}

test('applications default to pending and filter/search all application statuses', () => {
    const view = harness();
    assert.match(view.render(), /Store 01/);
    assert.doesNotMatch(view.render(), /Store 02/);
    assert.equal(view.queryStatuses[0], undefined);
    view.filter('REVIEWED');
    assert.match(view.render(), /Store 02/);
    view.filter('ALL');
    for (const query of ['STORE 02', 'APPLICANT 2', 'Full name 2', 'design 2', '2']) {
        view.search(query);
        const html = view.render();
        assert.match(html, /Store 02/);
        assert.doesNotMatch(html, /Store 01/);
    }
    view.search('not found');
    assert.match(view.render(), /No applications found/);
    view.button('Clear search').onClick();
    assert.match(view.render(), /Store 01/);
});

test('pagination and sorting remain valid after filtering or result count changes', () => {
    const data = Array.from({ length: 12 }, (_, i) => application(i + 1));
    const view = harness({ data });
    const newest = view.render();
    assert.ok(newest.indexOf('Store 12') < newest.indexOf('Store 11'));
    view.button('Next page').onClick();
    assert.match(view.render(), /11–12 of 12/);
    data.splice(0, 2);
    assert.match(view.render(), /1–10 of 10/);
    view.search('Store 12');
    assert.match(view.render(), /1–1 of 1/);
    view.search(''); view.sort('oldest');
    const oldest = view.render();
    assert.ok(oldest.indexOf('Store 03') < oldest.indexOf('Store 04'));
    view.sort('name');
    const byName = view.render();
    assert.ok(byName.indexOf('Store 03') < byName.indexOf('Store 04'));
});

test('review shows the full application, ID link, and only valid HTTP portfolio URLs', () => {
    for (const portfolio of ['https://example.com/portfolio', 'javascript:alert(1)', 'invalid-url', null]) {
        const item = application(1); item.portfolioLink = portfolio;
        const view = harness({ data: [item] });
        view.render(); view.open('Review application 1');
        const html = view.render();
        assert.match(html, /Original illustration and design 1/);
        assert.match(html, /href="\/admin\/applications\/1"/);
        assert.match(html, /Uploaded/);
        if (portfolio?.startsWith('https:')) assert.match(html, /href="https:\/\/example.com\/portfolio"/);
        else assert.doesNotMatch(html, /href="(?:javascript|invalid-url)/);
    }
});

test('approval requires confirmation, uses the application ID, and closes only on success', () => {
    const view = harness();
    view.render(); view.open('Review application 1'); view.render();
    view.button('Approve').onClick();
    assert.equal(view.calls.length, 0);
    assert.match(view.render(), /This gives the applicant seller access/);
    view.button('Approve application').onClick();
    assert.equal(view.calls[0].name, 'approve');
    assert.equal(view.calls[0].value, 1);
    view.approve.error = new Error('failed');
    const failed = view.render();
    assert.match(failed, /Unable to update this application/);
    assert.match(failed, /Approve this application\?/);
    view.calls[0].options.onSuccess();
    assert.match(view.render(), /Application #1 approved/);
});

test('rejection requires a reason, trims it, and preserves it for retry after failure', () => {
    const view = harness();
    view.render(); view.open('Review application 1'); view.render();
    view.button('Reject').onClick(); view.render();
    assert.equal(view.button('Reject application').disabled, true);
    view.button('Reject application').onClick();
    assert.equal(view.calls.length, 0);
    view.reason('  Incomplete or inaccurate application details  '); view.render();
    view.button('Reject application').onClick();
    assert.equal(view.calls[0].name, 'reject');
    assert.equal(view.calls[0].value.id, 1);
    assert.equal(view.calls[0].value.adminNote, 'Incomplete or inaccurate application details');
    view.reject.error = new Error('failed'); view.render();
    assert.equal(view.button('Reject application').disabled, false);
    view.button('Reject application').onClick();
    assert.equal(view.calls[1].value.adminNote, view.calls[0].value.adminNote);
    view.calls[1].options.onSuccess();
    assert.match(view.render(), /Application #1 rejected/);
});

test('returning to review clears the reason before a new rejection confirmation', () => {
    const view = harness();
    view.render(); view.open('Review application 1'); view.render();
    view.button('Reject').onClick(); view.render();
    view.reason('Custom reason'); view.render();
    assert.equal(view.button('Reject application').disabled, false);
    view.button('Back').onClick(); view.render();
    view.button('Reject').onClick(); view.render();
    assert.equal(view.button('Reject application').disabled, true);
});

test('reviewed applications cannot be approved or rejected again', () => {
    for (const status of ['APPROVED', 'REJECTED', 'REVOKED']) {
        const view = harness({ data: [application(1, status)] });
        view.render(); view.filter('REVIEWED'); view.render(); view.open('View application 1');
        const html = view.render();
        assert.doesNotMatch(html, />Approve<|>Reject</);
        assert.match(html, />Close</);
        if (status === 'REJECTED') assert.match(html, /Incomplete application/);
    }
});

test('both pending mutations block repeat submissions and disable Back', () => {
    for (const action of ['Approve', 'Reject']) {
        const view = harness();
        view.render(); view.open('Review application 1'); view.render();
        view.button(action).onClick(); view.render();
        if (action === 'Reject') view.reason('Incomplete details');
        view[action.toLowerCase()].isPending = true; view.render();
        assert.equal(view.button('Back').disabled, true);
        const label = action === 'Approve' ? 'Approving…' : 'Rejecting…';
        assert.equal(view.button(label).disabled, true);
        view.button(label).onClick();
        assert.equal(view.calls.length, 0);
    }
});

test('loading, retry, missing data and empty queues have separate states', () => {
    const view = harness({ loadError: true, missingData: true });
    assert.match(view.render(), /Unable to load applications/);
    view.button('Try again').onClick();
    assert.deepEqual(view.refreshes, ['applications']);
    assert.match(harness({ loading: true }).render(), /Loading applications/);
    assert.match(harness({ missingData: true }).render(), /Unable to load applications/);
    assert.match(harness({ data: [] }).render(), /No pending applications/);
});
