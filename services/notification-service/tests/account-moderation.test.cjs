const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

test("suspend and unsuspend generate distinct in-app notifications and tolerate redelivery", async () => {
    const exports = {};
    const notifications = new Map();
    const compiled = ts.transpileModule(readFileSync(join(__dirname, "../src/consumers/accountModeration.ts"), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    runInNewContext(compiled, { exports, require(name) {
        if (name !== "../lib/prisma") return {};
        return { prisma: { notification: { createMany: async ({ data: [record], skipDuplicates }) => {
            assert.equal(skipDuplicates, true);
            if (!notifications.has(record.accountModerationId)) notifications.set(record.accountModerationId, record);
        } } } };
    } });

    const suspension = { id: 1, userId: 27, suspended: true, reason: "Policy violation", createdAt: "2026-11-13T01:00:00Z" };
    const restoration = { ...suspension, id: 2, suspended: false, reason: "Appeal accepted", createdAt: "2026-11-13T02:00:00Z" };
    await exports.recordAccountModeration(restoration);
    await exports.recordAccountModeration(suspension);
    await exports.recordAccountModeration(suspension);

    assert.equal(notifications.size, 2);
    assert.equal(notifications.get(1).userId, 27);
    assert.equal(notifications.get(1).type, "ACCOUNT_SUSPENDED");
    assert.equal(notifications.get(1).body, "Reason: Policy violation");
    assert.equal(notifications.get(1).createdAt.toISOString(), "2026-11-13T01:00:00.000Z");
    assert.equal(notifications.get(2).type, "ACCOUNT_UNSUSPENDED");
    assert.equal(notifications.get(2).body, "Reason: Appeal accepted");
});
