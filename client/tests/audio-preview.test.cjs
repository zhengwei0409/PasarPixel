const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(readFileSync(join(__dirname, '../src/hooks/useAudioPreview.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup(failDecode = false) {
    const queries = [], states = [];
    let closed = false;
    const exports = {};
    runInNewContext(code, {
        exports, AbortSignal,
        fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }),
        AudioContext: class {
            async decodeAudioData() {
                if (failDecode) throw new Error('Unsupported audio');
                return { length: 4, numberOfChannels: 2, getChannelData: channel => channel ? [0.2, 0, 0, -0.75] : [0, 0.5, -1, 0.25] };
            }
            async close() { closed = true; }
        },
        require: name => name === 'react' ? {
            useRef: () => ({ current: null }),
            useState: value => { const state = { value }; states.push(state); return [value, next => { state.value = next; }]; },
            useEffect: effect => effect(),
        } : { useQuery: options => { queries.push(options); return {}; } },
    });
    return { hook: exports.useAudioPreview, queries, states, closed: () => closed };
}
function audio() {
    return { paused: true, duration: 10, currentTime: 0, pause() { this.paused = true; }, async play() { this.paused = false; } };
}
test('a new preview pauses the previous preview; toggle pauses the current one', async () => {
    const { hook } = setup();
    const first = hook('first.m4a'), second = hook('second.m4a');
    first.audioRef.current = audio(); second.audioRef.current = audio();
    await first.togglePlayback(); first.claimPlayback();
    await second.togglePlayback(); second.claimPlayback();
    assert.equal(first.audioRef.current.paused, true);
    assert.equal(second.audioRef.current.paused, false);
    await second.togglePlayback();
    assert.equal(second.audioRef.current.paused, true);
});
test('seeking clamps to preview bounds and ignores unknown duration', () => {
    const preview = setup().hook('preview.m4a');
    const element = preview.audioRef.current = audio();
    preview.seek(4.5); assert.equal(element.currentTime, 4.5);
    preview.seek(999); assert.equal(element.currentTime, 10);
    preview.seek(-10); assert.equal(element.currentTime, 0);
    element.duration = NaN; preview.seek(5); assert.equal(element.currentTime, 0);
});
test('playback errors are reported without marking the preview as playing', async () => {
    const { hook, states } = setup();
    const preview = hook('preview.m4a');
    preview.audioRef.current = { ...audio(), play: async () => { throw new Error('Unavailable'); } };
    await preview.togglePlayback();
    assert.equal(states[0].value, false); assert.match(states[3].value, /Preview unavailable/);
});
test('waveform uses amplitudes from all channels and closes the decoder', async () => {
    const { hook, queries, closed } = setup(); hook('preview.m4a');
    const peaks = await queries[0].queryFn({ signal: new AbortController().signal });
    assert.deepEqual(Array.from(peaks), [0.2, 0.5, 1, 0.75]); assert.equal(closed(), true);
});
test('decoder closes on failure; absent previews disable waveform fetching', async () => {
    const { hook, queries, closed } = setup(true); hook(null);
    assert.equal(queries[0].enabled, false);
    await assert.rejects(queries[0].queryFn({ signal: new AbortController().signal }), /Unsupported audio/);
    assert.equal(closed(), true);
});
