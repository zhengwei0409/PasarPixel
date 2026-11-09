const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = ts.transpileModule(readFileSync(join(__dirname, '../src/components/AdminDashboardSection.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderDashboard(data, { displayCurrency = 'USD', download = {} } = {}) {
    const exports = {};
    const icon = () => null;
    const modules = {
        react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => icon }),
        recharts: new Proxy({}, { get: () => () => null }),
        './ui/button': { Button: (props) => {
            if (React.Children.toArray(props.children).includes('Export report ')) download.click = props.onClick;
            return React.createElement('button', props);
        } },
        './ui/select': { Select: ({ children }) => React.createElement('div', null, children), SelectContent: ({ children }) => React.createElement('div', null, children), SelectItem: 'div', SelectTrigger: 'button', SelectValue: 'span' },
        './ui/card': { Card: 'section', CardContent: 'div', CardHeader: 'header' },
        './ui/chart': { ChartContainer: 'div', ChartTooltip: 'div', ChartTooltipContent: 'div' },
        '../hooks/useDashboardStats': { useDashboardStats: () => ({ data, isLoading: false, isError: false }) },
        '../hooks/useRoleLogs': { useRoleLogs: () => ({ data: [] }) },
        '../hooks/useAssetReviewLogs': { useAssetReviewLogs: () => ({ data: [] }) },
        '../stores/currencyStore': { useCurrencyStore: (selector) => selector({ displayCurrency }) },
        '../lib/price': { convertFiat: (value, from, to) => from === to ? value : from === 'USD' ? value * 4.7 : value / 4.7, formatPrice: (value) => `$${value}`, formatLamportsSol: (value) => `${value} SOL` },
    };
    runInNewContext(source, { exports, Blob,
        URL: { createObjectURL: (blob) => { download.blob = blob; return 'blob:test'; }, revokeObjectURL: () => {} },
        document: { createElement: () => {
            download.anchor = { click: () => { download.clicked = true; } };
            return download.anchor;
        } },
        require: (name) => {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
    } });
    return renderToStaticMarkup(React.createElement(exports.default));
}

const legacy = { totalUsers: 20, totalAssets: 12, totalRevenue: 100, revenueCurrency: 'USD', pendingItems: 9 };

test('admin dashboard renders with the older API response instead of crashing', () => {
    const html = renderDashboard(legacy);
    assert.match(html, /Dashboard/);
    assert.match(html, /Seller applications to review/);
    assert.match(html, /Assets awaiting review/);
    assert.match(html, /—/);
    assert.doesNotMatch(html, /undefined/);
});

for (const [displayCurrency, total, monthly] of [['USD', '1.48', '0.74'], ['MYR', '6.96', '3.48']]) {
    test(`CSV export keeps SOL columns aligned and converts fiat revenue to ${displayCurrency}`, async () => {
        const download = {};
        renderDashboard({ ...legacy, totalRevenue: 1.48, solVolumeLamports: '100000', solCommissionLamports: '5000',
            monthlyTrends: [{ month: '2026-10', users: 2, revenue: 0.74 }],
        }, { displayCurrency, download });
        download.click();
        assert.equal(download.clicked, true);
        assert.match(download.anchor.download, /^pasarpixel-report-\d{4}-\d{2}-\d{2}\.csv$/);
        const rows = (await download.blob.text()).split('\r\n');
        assert.ok(rows.includes(`Total sales (${displayCurrency}),${total},${displayCurrency}`));
        assert.ok(rows.includes('Total SOL sales (lamports),100000,SOL lamports'));
        assert.ok(rows.includes('Platform fees from SOL sales (lamports),5000,SOL lamports'));
        assert.ok(rows.includes(`Month (UTC),New users,Sales (${displayCurrency})`));
        assert.ok(rows.includes(`2026-10,2,${monthly}`));
    });
}

test('admin dashboard renders queue counts and charts with the updated API response', () => {
    const html = renderDashboard({ ...legacy, pendingApplications: 2, pendingAssets: 3, pendingReports: 4, monthlyTrends: [{ month: '2026-10', users: 5, revenue: 100 }] });
    assert.match(html, /Dashboard/);
    assert.match(html, /aria-label="4 reports awaiting review"/);
    assert.match(html, /New users per month/);
    assert.match(html, /Monthly sales \(USD\)/);
});

 test('dashboard management cards appear above metrics and user and asset cards link to admin pages', () => {
    const html = renderDashboard(legacy);
    assert.ok(html.indexOf('Manage marketplace') < html.indexOf('Total users'));
    assert.equal((html.match(/href="\/admin\/users"/g) ?? []).length, 1);
    assert.match(html, /href="\/admin\/assets"/);
    assert.match(html, /View all assets/);
    assert.match(html, /href="\/admin\/sellers"/);
    assert.match(html, /href="\/admin\/reports"/);
    assert.doesNotMatch(html, /Your profile|href="\/profile"/);
});
