const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const axios = require('axios');
const ts = require('typescript');

function token({ sub = 1, roles = ['BUYER'], exp = Math.floor(Date.now() / 1000) + 900, email = 'buyer@example.com' } = {}) {
    return `header.${Buffer.from(JSON.stringify({ sub, email, roles, exp })).toString('base64url')}.signature`;
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

// Execute the real session and interceptors with actual Axios request handling.
// Only browser storage, query-cache clearing and the network adapter are replaced.
function fixture(handle = () => ({ status: 200, data: {} })) {
    const values = new Map();
    const localStorage = {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
        clear: () => values.clear(),
    };
    const window = new EventTarget();
    const requests = [];
    let clears = 0;
    const fakeAxios = {
        ...axios,
        create: config => axios.create({
            ...config,
            adapter: async request => {
                requests.push(request);
                const result = await handle(request);
                const response = { statusText: '', headers: {}, config: request, ...result };
                if (response.status >= 400) {
                    throw new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', request, null, response);
                }
                return response;
            },
        }),
    };
    const modules = {};
    function load(name) {
        if (modules[name]) return modules[name];
        const source = readFileSync(join(__dirname, `../src/lib/${name}.ts`), 'utf8')
            .replaceAll('import.meta.env.VITE_API_URL', "'http://api.test'");
        const compiled = ts.transpileModule(source, {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        const exports = {};
        modules[name] = exports;
        runInNewContext(compiled, {
            exports, localStorage, window, atob, TextDecoder, Uint8Array,
            require: dependency => {
                if (dependency === 'axios') return fakeAxios;
                if (dependency === './queryClient') return { queryClient: { clear() { clears++; } } };
                if (dependency === './authSession') return load('authSession');
                throw new Error(`Unexpected dependency: ${dependency}`);
            },
        });
        return exports;
    }
    const session = load('authSession');
    const api = load('apiClient').default;
    const signIn = (accessToken = token(), refreshToken = 'refresh-a') => session.setAuthTokens({ accessToken, refreshToken });
    const storageEvent = key => {
        const event = new Event('storage');
        Object.assign(event, { key, storageArea: localStorage });
        window.dispatchEvent(event);
    };
    return { session, api, signIn, localStorage, requests, storageEvent, get clears() { return clears; } };
}

test('existing navbar and page subscribers both update when the session is cleared', () => {
    const f = fixture();
    f.signIn();
    const navbar = [], page = [];
    const stopNavbar = f.session.subscribeToAuth(() => navbar.push(f.session.getAuthUser()));
    const stopPage = f.session.subscribeToAuth(() => page.push(f.session.getAuthUser()));
    assert.equal(f.session.getAuthUser().email, 'buyer@example.com');
    assert.equal(f.session.getAuthUser(), f.session.getAuthUser(), 'snapshot identity stays stable');
    f.session.clearAuthSession();
    assert.deepEqual(navbar, [null]);
    assert.deepEqual(page, [null]);
    assert.equal(f.localStorage.getItem('refreshToken'), null);
    assert.equal(f.clears, 2);
    stopNavbar();
    stopPage();
});

test('login and role refresh notify every auth consumer without clearing same-account data', () => {
    const f = fixture();
    const seen = [];
    const stop = f.session.subscribeToAuth(() => seen.push([...f.session.getAuthUser().roles]));
    f.signIn();
    f.signIn(token({ roles: ['BUYER', 'SELLER'] }));
    assert.deepEqual(seen, [['BUYER'], ['BUYER', 'SELLER']]);
    assert.equal(f.clears, 1);
    stop();
});

test('other-tab logout and storage.clear update all consumers; unsubscribe removes notifications', () => {
    const f = fixture();
    f.signIn();
    const seen = [];
    const stopA = f.session.subscribeToAuth(() => seen.push(f.session.getAuthUser()));
    const stopB = f.session.subscribeToAuth(() => seen.push(f.session.getAuthUser()));
    stopA();
    f.localStorage.clear();
    f.storageEvent(null);
    assert.deepEqual(seen, [null]);
    stopB();
    f.storageEvent('accessToken');
    assert.deepEqual(seen, [null]);
});

test('a leftover access token without its refresh token does not show an account', async () => {
    const f = fixture();
    f.localStorage.setItem('accessToken', token());
    assert.equal(f.session.getAuthUser(), null);
    assert.equal(await f.session.getAccessToken(), null);
});

test('another tab refreshing its token updates roles without clearing the query cache', () => {
    const f = fixture();
    f.signIn();
    const seen = [];
    const stop = f.session.subscribeToAuth(() => seen.push([...f.session.getAuthUser().roles]));
    f.localStorage.setItem('accessToken', token({ roles: ['BUYER', 'SELLER'] }));
    f.storageEvent('accessToken');
    assert.deepEqual(seen, [['BUYER', 'SELLER']]);
    assert.equal(f.clears, 1);
    stop();
});

test('JWT decoding accepts base64url and Unicode email addresses', () => {
    const f = fixture();
    f.signIn(token({ email: '用户@example.com' }));
    assert.equal(f.session.getAuthUser().email, '用户@example.com');
});

test('parallel API calls share one refresh and all send the renewed token', async () => {
    const gate = deferred();
    const fresh = token();
    const f = fixture(request => request.url === '/auth/refresh' ? gate.promise : { status: 200, data: {} });
    f.signIn(token({ exp: 1 }));
    const calls = Array.from({ length: 8 }, () => f.api.get('/profile/me'));
    await new Promise(setImmediate);
    assert.equal(f.requests.filter(request => request.url === '/auth/refresh').length, 1);
    gate.resolve({ status: 200, data: { accessToken: fresh } });
    await Promise.all(calls);
    assert.ok(f.requests.filter(request => request.url !== '/auth/refresh').every(request => request.headers.Authorization === `Bearer ${fresh}`));
});

for (const status of [400, 401]) {
    test(`refresh ${status} clears the account in all mounted consumers`, async () => {
        const f = fixture(() => ({ status, data: {} }));
        f.signIn(token({ exp: 1 }));
        const seen = [];
        const stop = f.session.subscribeToAuth(() => seen.push(f.session.getAuthUser()));
        assert.equal(await f.session.getAccessToken(), null);
        assert.deepEqual(seen, [null]);
        assert.equal(f.localStorage.getItem('accessToken'), null);
        stop();
    });
}

for (const failure of ['offline', 503]) {
    test(`temporary refresh failure (${failure}) preserves tokens and can be retried`, async () => {
        let broken = true;
        const fresh = token();
        const f = fixture(() => {
            if (broken && failure === 'offline') throw new axios.AxiosError('Network Error', 'ERR_NETWORK');
            return broken ? { status: failure, data: {} } : { status: 200, data: { accessToken: fresh } };
        });
        const expired = token({ exp: 1 });
        f.signIn(expired);
        await assert.rejects(f.session.getAccessToken());
        assert.equal(f.localStorage.getItem('accessToken'), expired);
        assert.equal(f.localStorage.getItem('refreshToken'), 'refresh-a');
        assert.ok(f.session.getAuthUser());
        broken = false;
        assert.equal(await f.session.getAccessToken(), fresh);
    });
}

for (const replaceSession of [false, true]) {
    test(`a late refresh cannot restore or overwrite a ${replaceSession ? 'replaced' : 'logged-out'} session`, async () => {
        const gate = deferred();
        const f = fixture(() => gate.promise);
        f.signIn(token({ exp: 1 }));
        const refreshing = f.session.getAccessToken();
        await new Promise(setImmediate);
        if (replaceSession) f.signIn(token({ sub: 2 }), 'refresh-b');
        else f.session.clearAuthSession();
        gate.resolve({ status: 200, data: { accessToken: token() } });
        assert.equal(await refreshing, null);
        assert.equal(f.session.getAuthUser()?.sub ?? null, replaceSession ? '2' : null);
    });
}

test('an authenticated API 401 refreshes and retries once with the renewed token', async () => {
    const fresh = token({ exp: Math.floor(Date.now() / 1000) + 1800 });
    const f = fixture(request => {
        if (request.url === '/auth/refresh') return { status: 200, data: { accessToken: fresh } };
        return { status: request.headers.Authorization === `Bearer ${fresh}` ? 200 : 401, data: {} };
    });
    f.signIn();
    await f.api.get('/profile/me');
    assert.equal(f.requests.length, 3);
    assert.equal(f.localStorage.getItem('accessToken'), fresh);
});

test('a repeated API 401 stops retrying and clears shared auth', async () => {
    const f = fixture(request => request.url === '/auth/refresh'
        ? { status: 200, data: { accessToken: token() } } : { status: 401, data: {} });
    f.signIn();
    await assert.rejects(f.api.get('/profile/me'));
    assert.equal(f.requests.length, 3);
    assert.equal(f.session.getAuthUser(), null);
});

test('login 401 and permission 403 do not clear an existing session or trigger refresh', async () => {
    const f = fixture(request => ({ status: request.url === '/auth/login' ? 401 : 403, data: {} }));
    f.signIn();
    await assert.rejects(f.api.post('/auth/login', {}));
    await assert.rejects(f.api.get('/admin/users'));
    assert.equal(f.requests.length, 2);
    assert.ok(f.session.getAuthUser());
});

test('a failed old-account request is never retried with a different account', async () => {
    const gate = deferred();
    const f = fixture(() => gate.promise);
    f.signIn();
    const request = f.api.post('/cart', { assetId: 1 });
    await new Promise(setImmediate);
    f.signIn(token({ sub: 2 }), 'refresh-b');
    gate.resolve({ status: 401, data: {} });
    await assert.rejects(request);
    assert.equal(f.requests.length, 1);
    assert.equal(f.session.getAuthUser().sub, '2');
});
