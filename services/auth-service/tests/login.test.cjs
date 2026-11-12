const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

// Run the real controller with isolated database, signing, and verification
// dependencies so these checks do not require PostgreSQL or an OTP secret.
const source = readFileSync(join(__dirname, "../src/controllers/auth.controller.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function setup({ twoFactor = false, recovery = false, tokenPreference } = {}) {
    const persisted = [];
    let signedChallenge;
    let timeOffset = 0;
    const user = { id: 1, email: "buyer@example.com", passwordHash: "hash" };
    const twoFactorRecord = { id: 1, isEnabled: true, secret: "secret", failedAttempts: 0, lockedUntil: null };
    const recoveryCode = { id: 1, code: "recovery-hash", isUsed: false };
    const db = {
        user: { findUnique: async () => user, findUniqueOrThrow: async () => user },
        role: { findUnique: async () => ({ id: 1 }) },
        userRole: {
            findMany: async () => [],
            findUnique: async () => ({ userId: 1, roleId: 1 }),
            upsert: async () => {},
        },
        twoFactorAuth: {
            findUnique: async () => twoFactor ? { ...twoFactorRecord } : null,
            update: async ({ data }) => Object.assign(twoFactorRecord, data),
        },
        refreshToken: { create: async ({ data }) => persisted.push(data) },
        recoveryCode: {
            findMany: async () => recoveryCode.isUsed ? [] : [recoveryCode],
            updateMany: async () => {
                if (recoveryCode.isUsed) return { count: 0 };
                recoveryCode.isUsed = true;
                return { count: 1 };
            },
        },
        $queryRaw: async () => [{ ...twoFactorRecord }],
        $transaction: async (callback) => callback(db),
    };
    const dependencies = {
        bcryptjs: {
            compare: async (value, hash) => hash === "hash" || (recovery && value === "ab12-cd34-ef56"),
        },
        jsonwebtoken: {
            sign: (payload) => {
                if (payload.purpose === "2fa") {
                    signedChallenge = payload;
                    return "challenge";
                }
                return "access-token";
            },
            verify: (token) => {
                if (token === "expired") throw new Error("Expired token");
                return signedChallenge ?? { sub: 1, purpose: "2fa", rememberMe: tokenPreference };
            },
        },
        crypto: { randomBytes: () => Buffer.alloc(64) },
        otplib: { verify: async ({ token }) => ({ valid: token === "123456" }) },
        "../lib/prisma": { prisma: db },
        "../lib/publisher": { publishUserRegistered: async () => {} },
    };
    const exports = {};
    runInNewContext(compiled, {
        exports,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
        process: { env: { JWT_SECRET: "test-secret" } },
        Buffer,
        URLSearchParams,
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [Date.now() + timeOffset])); }
            static now() { return Date.now() + timeOffset; }
        },
    });

    async function request(handler, body) {
        const response = {
            statusCode: 200,
            headers: {},
            set(name, value) { this.headers[name] = value; return this; },
            status(code) { this.statusCode = code; return this; },
            json(value) { this.body = value; return this; },
            redirect(url) { this.location = url; return this; },
        };
        await exports[handler]({ body, user }, response);
        return response;
    }

    return { request, persisted, recoveryCode, advanceTime: (ms) => { timeOffset += ms; } };
}

function assertDuration(record, days, startedAt) {
    const duration = days * 24 * 60 * 60 * 1000;
    assert.ok(record.expiresAt.getTime() >= startedAt + duration);
    assert.ok(record.expiresAt.getTime() <= Date.now() + duration);
}

for (const [preference, days] of [[undefined, 7], [false, 7], [true, 30]]) {
    test(`password login with rememberMe=${preference} issues a ${days}-day refresh token`, async () => {
        const { request, persisted } = setup();
        const startedAt = Date.now();
        const response = await request("login", {
            email: "buyer@example.com", password: "password", rememberMe: preference,
        });
        assert.equal(response.statusCode, 200);
        assert.equal(response.body.accessToken, "access-token");
        assert.equal(persisted.length, 1);
        assertDuration(persisted[0], days, startedAt);
    });
}

test("login rejects non-boolean rememberMe values", async () => {
    const { request, persisted } = setup();
    const response = await request("login", {
        email: "buyer@example.com", password: "password", rememberMe: "true",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(persisted.length, 0);
});

for (const recovery of [false, true]) {
    test(`30-day preference survives ${recovery ? "recovery-code" : "authenticator"} verification`, async () => {
        const { request, persisted } = setup({ twoFactor: true, recovery });
        const startedAt = Date.now();
        const challenge = await request("login", {
            email: "buyer@example.com", password: "password", rememberMe: true,
        });
        assert.equal(challenge.body.twoFactorRequired, true);
        assert.equal(persisted.length, 0);
        const response = await request("verifyLogin", {
            tempToken: challenge.body.tempToken,
            code: recovery ? "ab12-cd34-ef56" : "123456",
        });
        assert.equal(response.statusCode, 200);
        assert.equal(persisted.length, 1);
        assertDuration(persisted[0], 30, startedAt);
    });
}

test("both code types share a 5-attempt lockout that survives restarting sign-in", async () => {
    const { request, persisted, recoveryCode, advanceTime } = setup({ twoFactor: true, recovery: true });
    const login = () => request("login", { email: "buyer@example.com", password: "password" });
    let { body: challenge } = await login();
    const verify = (code, tempToken = challenge.tempToken) => request("verifyLogin", { code, tempToken });
    const wrongCodes = ["654321", "aaaa-bbbb-cccc", "654321", "aaaa-bbbb-cccc"];

    assert.equal(challenge.attemptsRemaining, 5);
    assert.equal((await verify("654321", "expired")).body.code, "TWO_FACTOR_CHALLENGE_EXPIRED");
    for (const [index, wrongCode] of wrongCodes.entries()) {
        const response = await verify(wrongCode);
        assert.equal(response.statusCode, 401);
        assert.equal(response.body.attemptsRemaining, 4 - index);
        ({ body: challenge } = await login());
        assert.equal(challenge.attemptsRemaining, 4 - index);
    }

    const locked = await verify("654321");
    assert.equal(locked.statusCode, 429);
    assert.equal(locked.body.attemptsRemaining, 0);
    assert.equal(locked.headers["Retry-After"], "900");
    ({ body: challenge } = await login());
    assert.equal(+challenge.lockedUntil, +locked.body.lockedUntil);
    const googleRedirect = new URL((await request("googleCallback")).location);
    assert.equal(googleRedirect.searchParams.get("attemptsRemaining"), "0");
    assert.equal(googleRedirect.searchParams.get("lockedUntil"), locked.body.lockedUntil.toISOString());

    advanceTime(14 * 60 * 1000);
    for (const code of ["123456", "ab12-cd34-ef56"]) {
        const response = await verify(code);
        assert.equal(response.statusCode, 429);
        assert.equal(+response.body.lockedUntil, +locked.body.lockedUntil);
    }
    assert.equal(recoveryCode.isUsed, false);
    assert.equal(persisted.length, 0);

    advanceTime(61 * 1000);
    ({ body: challenge } = await login());
    assert.equal(challenge.lockedUntil, null);
    assert.equal(challenge.attemptsRemaining, 5);
    assert.equal((await verify("654321")).body.attemptsRemaining, 4);
    assert.equal((await verify("ab12-cd34-ef56")).statusCode, 200);
    assert.equal(recoveryCode.isUsed, true);
    assert.equal((await verify("ab12-cd34-ef56")).body.attemptsRemaining, 4);
});

for (const tokenPreference of [undefined, false]) {
    test(`2FA preference ${tokenPreference} keeps seven days despite a request-body override`, async () => {
        const { request, persisted } = setup({ twoFactor: true, tokenPreference });
        const startedAt = Date.now();
        const response = await request("verifyLogin", {
            tempToken: "challenge", code: "123456", rememberMe: true,
        });
        assert.equal(response.statusCode, 200);
        assert.equal(persisted.length, 1);
        assertDuration(persisted[0], 7, startedAt);
    });
}
