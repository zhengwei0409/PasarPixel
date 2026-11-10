const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const jsxRuntime = require('react/jsx-runtime');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/AdminApplicationDetailPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const application = (overrides = {}) => ({ id: 14, userId: 42, storeName: 'Ruang Studio', status: 'PENDING', user: { name: 'Aina Rahman', email: 'aina@example.com' }, fullName: 'Aina Rahman', dateOfBirth: '1997-06-12T00:00:00.000Z', address: 'Sample address', reason: 'Original illustrations and templates.', portfolioLink: 'https://example.com/portfolio', idDocumentKey: 'private/id.jpg', adminNote: null, createdAt: '2026-11-09T02:00:00.000Z', reviewedAt: null, ...overrides });
const flush = () => new Promise(setImmediate);
function harness({ data = application(), loading = false, loadError = false, missingData = false, routeId = '14' } = {}) {
    const state = [];
    let cursor = 0, buttons, picker, previews;
    let download = async () => 'https://docs.example.test/id.jpg?signature=one';
    const calls = [], downloads = [], queries = [], navigations = [], refreshes = [];
    const mutation = (name) => ({ isPending: false, error: null, reset() { this.error = null; }, mutate(value, options) { calls.push({ name, value, options }); } });
    const approve = mutation('approve'), reject = mutation('reject');
    const document = { isPending: false, mutateAsync: async (id) => { downloads.push(id); return download(id); } };
    const wrapJsx = (name) => (type, props, key) => { if (type === 'img' || type === 'iframe') previews.push({ type, ...props }); return jsxRuntime[name](type, props, key); };
    const modules = {
        react: { ...React, useState: (initial) => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], (value) => { state[index] = value; }]; }, useRef: (value) => { const index = cursor++; return state[index] ??= { current: value }; } },
        'react/jsx-runtime': { ...jsxRuntime, jsx: wrapJsx('jsx'), jsxs: wrapJsx('jsxs') },
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children), useParams: () => ({ id: routeId }), useNavigate: () => (path) => navigations.push(path) },
        'lucide-react': new Proxy({}, { get: () => () => null }),
        '../components/ui/button': { Button: ({ children, variant, size, ...props }) => { buttons.push({ children, ...props }); return React.createElement('button', props, children); } },
        '../components/ui/dialog': { Dialog: ({ open, children }) => open ? React.createElement('div', null, children) : null, DialogContent: ({ children }) => React.createElement('div', null, children), DialogDescription: 'p', DialogFooter: 'div', DialogHeader: 'header', DialogTitle: 'h2' },
        '../components/ReasonPicker': { __esModule: true, default: (props) => { picker = props; return null; } },
        '../lib/adminReasons': { APPLICATION_REJECT_REASONS: ['Incomplete or inaccurate application details'] },
        '../lib/errors': { getErrorMessage: (_, fallback) => fallback },
        '../hooks/useSellerApplication': { useApplication: (id) => { queries.push(id); return { data: missingData ? undefined : data, isLoading: loading, error: loadError ? new Error('failed') : null, refetch: () => refreshes.push('application') }; }, useIdDocumentDownloadUrl: () => document, useApproveApplication: () => approve, useRejectApplication: () => reject },
    };
    const exports = {};
    runInNewContext(code, { exports, URL, require: (name) => { assert.ok(name in modules, name); return modules[name]; } });
    const render = () => { cursor = 0; buttons = []; picker = null; previews = []; return renderToStaticMarkup(React.createElement(exports.default)); };
    const button = (label) => { const found = buttons.findLast((item) => React.Children.toArray(item.children).filter((child) => typeof child === 'string').join('') === label); assert.ok(found, label); return found; };
    return { render, calls, downloads, queries, navigations, refreshes, approve, reject, document, button,
        open: (label) => button(label).onClick({ currentTarget: { isConnected: true, focus() {} } }),
        reason: (value) => picker.onChange(value),
        setDownload: (fn) => { download = fn; },
        preview: (type) => previews.find((item) => item.type === type),
    };
}

test('applicant facts and safe portfolio links render without opening the ID automatically', () => {
    const view = harness();
    const html = view.render();
    assert.match(html, /Ruang Studio/);
    assert.match(html, /Legal name/);
    assert.match(html, /aina@example.com/);
    assert.match(html, /Original illustrations and templates/);
    assert.match(html, /href="https:\/\/example.com\/portfolio"/);
    assert.equal(view.downloads.length, 0);
    assert.equal(view.queries[0], 14);
    const unsafe = harness({ data: application({ portfolioLink: 'javascript:alert(1)', fullName: null, address: null, dateOfBirth: null }) }).render();
    assert.match(unsafe, /Link unavailable/);
    assert.doesNotMatch(unsafe, /href="javascript:/);
    assert.match(unsafe, /—/);
});

test('ID opens on demand, can be hidden, and refreshes its signed URL', async () => {
    const view = harness(); view.render();
    view.button('View ID').onClick(); await flush();
    assert.match(view.render(), /Applicant ID document/);
    assert.equal(view.downloads[0], 14);
    assert.equal(view.preview('img').src, 'https://docs.example.test/id.jpg?signature=one');
    view.setDownload(async () => 'https://docs.example.test/id.jpg?signature=two');
    view.button('Refresh ID').onClick(); await flush(); view.render();
    assert.equal(view.preview('img').src, 'https://docs.example.test/id.jpg?signature=two');
    view.button('Hide ID').onClick();
    assert.doesNotMatch(view.render(), /signature=two/);
    view.button('View ID').onClick(); await flush(); view.render();
    assert.equal(view.downloads.length, 3);
});

test('PDFs use an iframe and unavailable/broken previews keep a recovery path', async () => {
    const pdf = harness({ data: application({ idDocumentKey: 'private/document.PDF' }) }); pdf.render();
    pdf.button('View ID').onClick(); await flush(); pdf.render();
    assert.ok(pdf.preview('iframe'));
    assert.equal(pdf.preview('img'), undefined);
    pdf.preview('iframe').onError();
    assert.match(pdf.render(), /Unable to display the preview/);
    assert.match(pdf.render(), /Open ID in new tab/);
    assert.ok(pdf.button('Refresh ID'));
    const missing = harness({ data: application({ idDocumentKey: null }) });
    assert.match(missing.render(), /No ID document uploaded/);
    assert.equal(missing.downloads.length, 0);
});

test('ID fetch failures and invalid URLs show retry, while pending requests disable opening', async () => {
    const view = harness(); view.setDownload(async () => { throw new Error('expired'); }); view.render();
    view.button('View ID').onClick(); await flush();
    assert.match(view.render(), /Unable to open the ID document/);
    view.setDownload(async () => 'javascript:alert(1)');
    view.button('Try again').onClick(); await flush();
    assert.doesNotMatch(view.render(), /src="javascript:/);
    view.setDownload(async () => 'https://docs.example.test/retry.jpg');
    view.button('Try again').onClick(); await flush();
    assert.match(view.render(), /retry.jpg/);
    const busy = harness(); busy.document.isPending = true; busy.render();
    assert.equal(busy.button('Opening…').disabled, true);
    busy.button('Opening…').onClick(); await flush();
    assert.equal(busy.downloads.length, 0);
});

test('approval needs confirmation, targets the application, and navigates only on success', () => {
    const view = harness(); view.render(); view.open('Approve application'); view.render();
    assert.equal(view.calls.length, 0);
    view.button('Approve application').onClick();
    assert.equal(view.calls[0].name, 'approve');
    assert.equal(view.calls[0].value, 14);
    view.approve.error = new Error('failed');
    assert.match(view.render(), /Unable to update this application/);
    assert.equal(view.navigations.length, 0);
    view.calls[0].options.onSuccess();
    assert.deepEqual(view.navigations, ['/admin/applications']);
});

test('rejection requires a reason, trims it, and retains it after a failed request', () => {
    const view = harness(); view.render(); view.open('Reject application'); view.render();
    assert.equal(view.button('Reject application').disabled, true);
    view.button('Reject application').onClick();
    assert.equal(view.calls.length, 0);
    view.reason('   '); view.render();
    assert.equal(view.button('Reject application').disabled, true);
    view.reason('  Incomplete or inaccurate application details  '); view.render();
    view.button('Reject application').onClick();
    assert.equal(view.calls[0].value.id, 14);
    assert.equal(view.calls[0].value.adminNote, 'Incomplete or inaccurate application details');
    view.reject.error = new Error('failed'); view.render();
    assert.equal(view.button('Reject application').disabled, false);
    view.button('Reject application').onClick();
    assert.equal(view.calls[1].value.adminNote, view.calls[0].value.adminNote);
    view.calls[1].options.onSuccess();
    assert.deepEqual(view.navigations, ['/admin/applications']);
});

test('Cancel clears the reason when reopening and pending decisions prevent repeat submissions', () => {
    const view = harness(); view.render(); view.open('Reject application'); view.render();
    view.reason('Custom reason'); view.render();
    view.button('Cancel').onClick(); view.render();
    view.open('Reject application'); view.render();
    assert.equal(view.button('Reject application').disabled, true);
    view.reason('Custom reason'); view.reject.isPending = true; view.render();
    assert.equal(view.button('Cancel').disabled, true);
    view.button('Rejecting…').onClick();
    assert.equal(view.calls.length, 0);
});

test('reviewed applications show the saved reason without approval/rejection actions', () => {
    for (const status of ['APPROVED', 'REJECTED', 'REVOKED']) {
        const html = harness({ data: application({ status, adminNote: 'Saved review reason', reviewedAt: '2026-11-10T03:00:00Z' }) }).render();
        assert.match(html, /Saved review reason/);
        assert.match(html, /Reviewed/);
        assert.doesNotMatch(html, />Approve application<|>Reject application</);
    }
});

test('loading, fetch errors and invalid routes have useful states and retry', () => {
    const failed = harness({ loadError: true, missingData: true });
    assert.match(failed.render(), /Unable to load this application/);
    failed.button('Try again').onClick();
    assert.deepEqual(failed.refreshes, ['application']);
    assert.match(harness({ loading: true }).render(), /Loading application/);
    assert.match(harness({ missingData: true }).render(), /Application not found/);
    for (const routeId of ['bad', '0', '-1', '1.5']) {
        const invalid = harness({ routeId });
        assert.match(invalid.render(), /Application not found/);
        assert.equal(invalid.queries.length, 0);
    }
});
