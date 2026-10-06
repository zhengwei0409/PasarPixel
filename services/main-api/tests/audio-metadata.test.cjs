const assert = require("node:assert/strict");
const { readFileSync, promises: fs } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const source = readFileSync(join(__dirname, "../src/lib/audioMetadata.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const exportsObject = {};
runInNewContext(compiled, { exports: exportsObject, require });
const { audioMetadata } = exportsObject;

test("audio metadata captures full duration independently of the clipped preview", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "audio-metadata-test-"));
    try {
        const audio = join(dir, "tone.wav");
        execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=20.5", audio]);
        const metadata = await audioMetadata(await fs.readFile(audio));
        assert.ok(Math.abs(metadata.durationSeconds - 20.5) < 0.01);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test("invalid audio buffers reject and remove temporary metadata files", async () => {
    const temporaryFiles = async () => (await fs.readdir(tmpdir())).filter((name) => name.endsWith("-metadata-audio")).sort();
    const before = await temporaryFiles();
    await assert.rejects(() => audioMetadata(Buffer.from("invalid audio")));
    assert.deepEqual(await temporaryFiles(), before);
});
