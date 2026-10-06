const assert = require("node:assert/strict");
const { readFileSync, promises: fs } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const source = readFileSync(join(__dirname, "../src/lib/videoMetadata.ts"), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
const exportsObject = {};
runInNewContext(compiled, { exports: exportsObject, require });
const { videoMetadata } = exportsObject;

// Probe real video buffers so FFmpeg's rotation tags and fractional rates
// exercise the same parsing used on uploads, including fluent-ffmpeg's fields.
test("video metadata preserves fractional frame rates, full duration, and rotated orientation", async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), "video-metadata-test-"));
    try {
        const base = join(dir, "base.mp4");
        const rotated = join(dir, "rotated.mp4");
        execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=green:s=192x108:r=30000/1001", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", base]);
        const metadata = await videoMetadata(await fs.readFile(base));
        assert.equal(metadata.width, 192);
        assert.equal(metadata.height, 108);
        assert.ok(Math.abs(metadata.frameRate - 30000 / 1001) < 0.001);
        assert.ok(Math.abs(metadata.durationSeconds - 2) < 0.1);
        execFileSync("ffmpeg", ["-loglevel", "error", "-display_rotation", "90", "-i", base, "-c", "copy", rotated]);
        const portrait = await videoMetadata(await fs.readFile(rotated));
        assert.equal(portrait.width, 108);
        assert.equal(portrait.height, 192);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

test("unreadable video buffers reject and remove their temporary metadata files", async () => {
    const temporaryFiles = async () => (await fs.readdir(tmpdir())).filter((name) => name.endsWith("-metadata-video")).sort();
    const before = await temporaryFiles();
    await assert.rejects(() => videoMetadata(Buffer.from("invalid video")));
    assert.deepEqual(await temporaryFiles(), before);
});
