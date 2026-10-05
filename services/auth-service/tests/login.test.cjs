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
    const user = { id: 1, email: "buyer@example.com", passwordHash: "hash" };
    const dependencies = {
        bcryptjs: { compare: async () => true },
        jsonwebtoken: {
            sign: (payload) => {
                if (payload.purpose === "2fa") {
                    signedChallenge = payload;
                    return "challenge";
                }
                return "access-token";
            },
            verify: () => signedChallenge ?? { sub: 1, purpose: "2fa", rememberMe: tokenPreference },
        },
        crypto: { randomBytes: () => Buffer.alloc(64) },
        otplib: { verify: async () => ({ valid: !recovery }) },
        "../lib/prisma": {
            prisma: {
                user: { findUnique: async () => user },
                userRole: { findMany: async () => [] },
                twoFactorAuth: { findUnique: async () => twoFactor ? { id: 1, isEnabled: true, secret: "secret" } : null },
                refreshToken: { create: async ({ data }) => persisted.push(data) },
                recoveryCode: {
                    findMany: async () => [{ id: 1, code: "recovery-hash" }],
                    update: async () => {},
                },
            },
        },
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
    });

    async function request(handler, body) {
        const response = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(value) { this.body = value; return this; },
        };
        await exports[handler]({ body }, response);
        return response;
    }

    return { request, persisted };
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
            code: recovery ? "xxxx-xxxx-xxxx" : "123456",
        });
        assert.equal(response.statusCode, 200);
        assert.equal(persisted.length, 1);
        assertDuration(persisted[0], 30, startedAt);
    });
}

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
