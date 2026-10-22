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

function renderDashboard(data) {
    const exports = {};
    const icon = () => null;
    const modules = {
        react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
        'react-router-dom': { Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children) },
        'lucide-react': new Proxy({}, { get: () => icon }),
        recharts: new Proxy({}, { get: () => () => null }),
        './ui/button': { Button: 'button' },
        './ui/select': { Select: ({ children }) => React.createElement('div', null, children), SelectContent: ({ children }) => React.createElement('div', null, children), SelectItem: 'div', SelectTrigger: 'button', SelectValue: 'span' },
        './ui/card': { Card: 'section', CardContent: 'div', CardHeader: 'header' },
        './ui/chart': { ChartContainer: 'div', ChartTooltip: 'div', ChartTooltipContent: 'div' },
        '../hooks/useDashboardStats': { useDashboardStats: () => ({ data, isLoading: false, isError: false }) },
        '../hooks/useRoleLogs': { useRoleLogs: () => ({ data: [] }) },
        '../hooks/useAssetReviewLogs': { useAssetReviewLogs: () => ({ data: [] }) },
        '../stores/currencyStore': { useCurrencyStore: (selector) => selector({ displayCurrency: 'USD' }) },
        '../lib/price': { convertFiat: (value) => value, formatPrice: (value) => `$${value}`, formatLamportsSol: (value) => `${value} SOL` },
    };
    runInNewContext(source, { exports, require: (name) => {
        if (!(name in modules)) throw new Error(`Unexpected import: ${name}`);
        return modules[name];
    } });
    return renderToStaticMarkup(React.createElement(exports.default));
}

const legacy = { totalUsers: 20, totalAssets: 12, totalRevenue: 100, revenueCurrency: 'USD', pendingItems: 9 };

test('admin dashboard renders with the older API response instead of crashing', () => {
    const html = renderDashboard(legacy);
    assert.match(html, /Executive overview/);
    assert.match(html, /Pending seller applications/);
    assert.match(html, /Pending asset reviews/);
    assert.match(html, /—/);
    assert.doesNotMatch(html, /undefined/);
});

test('admin dashboard renders queue counts and charts with the updated API response', () => {
    const html = renderDashboard({ ...legacy, pendingApplications: 2, pendingAssets: 3, pendingReports: 4, monthlyTrends: [{ month: '2026-10', users: 5, revenue: 100 }] });
    assert.match(html, /Executive overview/);
    assert.match(html, /4 pending reports to review/);
    assert.match(html, /User growth trend/);
    assert.match(html, /Revenue performance/);
});

 test('dashboard management cards appear above metrics and user and asset cards link to admin pages', () => {
    const html = renderDashboard(legacy);
    assert.ok(html.indexOf('Manage marketplace') < html.indexOf('Total registered users'));
    assert.equal((html.match(/href="\/admin\/users"/g) ?? []).length, 1);
    assert.match(html, /href="\/admin\/assets"/);
    assert.match(html, /View all assets/);
    assert.match(html, /href="\/admin\/sellers"/);
    assert.match(html, /href="\/admin\/reports"/);
    assert.doesNotMatch(html, /Your profile|href="\/profile"/);
});
