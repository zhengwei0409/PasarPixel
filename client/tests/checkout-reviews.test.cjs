const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const clientRequire = createRequire(join(__dirname, '../package.json'));
const React = clientRequire('react');
const { renderToStaticMarkup } = clientRequire('react-dom/server');
const ts = clientRequire('typescript');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/pages/CheckoutSuccessPage.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

function renderCheckout({ sellerId = 3, status = 'PUBLISHED', error = null } = {}) {
    const order = {
        id: 9, buyerId: 7, paymentStatus: 'COMPLETED', createdAt: '2026-10-06T04:00:00Z', currency: 'USD', totalAmount: '25',
        orderItems: [{ id: 1, assetId: 10, licenseType: 'PERSONAL', licenseKey: 'license-1', asset: {
            title: 'Purchased model', files: [], sellerId, status, isDeleted: false, seller: { name: 'Creator' },
        } }],
    };
    const mutation = { isPending: false, isSuccess: false, isError: Boolean(error), error, mutate() {}, reset() {} };
    const exports = {};
    runInNewContext(code, {
        exports,
        require: name => {
            if (name === 'react' || name === 'react/jsx-runtime' || name === 'axios' || name === 'lucide-react') return clientRequire(name);
            if (name === 'react-router-dom') return {
                Link: ({ to, children, ...props }) => React.createElement('a', { href: to, ...props }, children),
                useSearchParams: () => [new URLSearchParams('orderId=9')],
            };
            if (name === '@tanstack/react-query') return {
                useQuery: ({ queryKey }) => ({ data: queryKey[0] === 'checkout' ? 'COMPLETED' : order, isPending: false, isError: false }),
                useQueryClient: () => ({ invalidateQueries() {} }),
            };
            if (name === '@/components/ui/button') return {
                Button: ({ asChild, variant, children, ...props }) => asChild ? children : React.createElement('button', props, children),
            };
            if (name === '@/hooks/useOrders') return {
                useDownloadCertificate: () => mutation, useDownloadOrder: () => mutation,
                useDownloadOrderItem: () => mutation, useDownloadReceipt: () => mutation,
            };
            if (name === '@/hooks/useAsset') return { useSubmitReview: () => mutation };
            if (name === '@/lib/price') return { formatPrice: amount => `$${Number(amount).toFixed(2)}` };
            if (name === '@/services/checkoutService') return { verifyCheckout() {} };
            if (name === '@/services/orderService') return { getOrderById() {} };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return renderToStaticMarkup(React.createElement(exports.default));
}

test('own purchases explain why reviews are unavailable and omit the review form', () => {
    const markup = renderCheckout({ sellerId: 7 });
    assert.match(markup, /You can’t review your own asset/);
    assert.doesNotMatch(markup, /<form/);
    assert.doesNotMatch(markup, /Submit Review/);
    assert.match(markup, /Download Asset/);
});

test('purchases from another seller include rating inputs, comment, and submit button', () => {
    const markup = renderCheckout();
    assert.match(markup, /<form/);
    assert.equal((markup.match(/type="radio"/g) || []).length, 5);
    assert.match(markup, /<textarea/);
    assert.match(markup, /Submit Review/);
});

test('unpublished assets explain the review restriction', () => {
    const markup = renderCheckout({ status: 'TAKEN_DOWN' });
    assert.match(markup, /this asset is no longer published/);
    assert.doesNotMatch(markup, /<form/);
});

test('submission failures display the server’s actual error message', () => {
    const markup = renderCheckout({ error: { isAxiosError: true, response: { data: { error: 'Only buyers who purchased this asset can review it' } } } });
    assert.match(markup, /Only buyers who purchased this asset can review it/);
});
