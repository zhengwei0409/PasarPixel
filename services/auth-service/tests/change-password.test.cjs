const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const compiled = ts.transpileModule(
    readFileSync(join(__dirname, "../src/controllers/auth.controller.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
).outputText;

function setup({ hasPassword = true, concurrentChange = false, googleId = null } = {}) {
    const writes = [];
    const user = { id: 7, passwordHash: hasPassword ? "old-hash" : null, googleId };
    const tx = {
        user: { updateMany: async (args) => { writes.push(args); return { count: concurrentChange ? 0 : 1 }; } },
        passwordReset: { updateMany: async (args) => { writes.push(args); return { count: 1 }; } },
    };
    const dependencies = {
        bcryptjs: {
            compare: async (value, hash) => value === "old-password" && hash === "old-hash",
            hash: async (value) => `hashed:${value}`,
        },
        jsonwebtoken: {}, crypto: {}, otplib: {},
        "../lib/prisma": { prisma: {
            user: { findUnique: async ({ where }) => { assert.equal(where.id, 7); return user; } },
            $transaction: async (fn) => fn(tx),
        } },
        "../lib/publisher": {},
    };
    const exports = {};
    runInNewContext(compiled, {
        exports, Buffer,
        require: (name) => {
            assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
    });
    async function request(handler, body) {
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; },
        };
        await exports[handler]({ userId: 7, body }, res);
        return res;
    }
    return { request, writes };
}

for (const [hasPassword, googleId] of [[true, null], [true, "google-linked"], [false, "google-only"]]) {
    test(`password status for hasPassword=${hasPassword}, googleId=${googleId}`, async () => {
        const { request } = setup({ hasPassword, googleId });
        const res = await request("passwordStatus");
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.hasPassword, hasPassword);
        assert.deepEqual(Object.keys(res.body), ["hasPassword"]);
    });
}

for (const body of [
    {},
    { currentPassword: 123, newPassword: "new-password" },
    { currentPassword: "old-password", newPassword: {} },
    { currentPassword: "old-password", newPassword: "short" },
    { currentPassword: "old-password", newPassword: "a".repeat(73) },
    { currentPassword: "old-password", newPassword: "😀".repeat(19) },
    { currentPassword: "wrong-password", newPassword: "new-password" },
    { currentPassword: "old-password", newPassword: "old-password" },
]) {
    test(`rejects invalid change: ${JSON.stringify(body)}`, async () => {
        const { request, writes } = setup();
        const res = await request("changePassword", body);
        assert.equal(res.statusCode, 400);
        assert.equal(writes.length, 0);
    });
}

test("Google-only accounts cannot create a password through change-password", async () => {
    const { request, writes } = setup({ hasPassword: false });
    const res = await request("changePassword", { currentPassword: "old-password", newPassword: "new-password" });
    assert.equal(res.statusCode, 400);
    assert.equal(writes.length, 0);
});

test("valid change hashes the new password and invalidates outstanding reset links", async () => {
    const { request, writes } = setup();
    const res = await request("changePassword", { currentPassword: "old-password", newPassword: "new-password" });
    assert.equal(res.statusCode, 200);
    assert.equal(writes.length, 2);
    assert.equal(writes[0].where.id, 7);
    assert.equal(writes[0].where.passwordHash, "old-hash");
    assert.equal(writes[0].data.passwordHash, "hashed:new-password");
    assert.equal(writes[1].where.userId, 7);
    assert.equal(writes[1].where.usedAt, null);
    assert.ok(writes[1].data.usedAt);
});

test("concurrent changes cannot overwrite a password verified against an outdated hash", async () => {
    const { request, writes } = setup({ concurrentChange: true });
    const res = await request("changePassword", { currentPassword: "old-password", newPassword: "new-password" });
    assert.equal(res.statusCode, 409);
    assert.equal(writes.length, 1);
});

for (const payload of [{ sub: 7 }, { sub: 7, purpose: "2fa" }, { sub: "7" }]) {
    test(`authenticated password routes reject incomplete login tokens: ${JSON.stringify(payload)}`, () => {
        const middleware = ts.transpileModule(
            readFileSync(join(__dirname, "../src/middleware/requireAuth.ts"), "utf8"),
            { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
        ).outputText;
        const exports = {};
        runInNewContext(middleware, {
            exports,
            require: (name) => {
                assert.equal(name, "jsonwebtoken");
                return { verify: () => payload };
            },
            process: { env: { JWT_SECRET: "test-secret" } },
        });
        const req = { headers: { authorization: "Bearer token" } };
        const res = { status(code) { this.statusCode = code; return this; }, json() {} };
        let reachedHandler = false;
        exports.requireAuth(req, res, () => { reachedHandler = true; });
        const valid = typeof payload.sub === "number" && !payload.purpose;
        assert.equal(reachedHandler, valid);
        if (valid) assert.equal(req.userId, 7);
        else assert.equal(res.statusCode, 401);
    });
}
