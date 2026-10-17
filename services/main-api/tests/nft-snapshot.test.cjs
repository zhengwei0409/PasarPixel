const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function load(file) {
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require, process, URL });
    return exports;
}
const { parseSolLamports } = load(join(__dirname, '../../../shared/utils/solPrice.ts'));
const { buildManifest, sha256 } = load(join(__dirname, '../src/lib/nftSnapshot.ts'));

test('SOL prices convert exactly to lamports and reject floating-point/exponent/zero/overflow inputs', () => {
    assert.equal(parseSolLamports('0.000000001'), 1n);
    assert.equal(parseSolLamports('0.123456789'), 123456789n);
    assert.equal(parseSolLamports('18446744073.709551615'), 18446744073709551615n);
    assert.equal(parseSolLamports(''), null);
    for (const input of ['0', '-1', '1e-9', '0.0000000001', '18446744073.709551616', 'Infinity', '1SOL', {}, true]) {
        assert.throws(() => parseSolLamports(input));
    }
});

test('manifest order is stable and hashes commit to actual content', () => {
    const files = [{ reference: 'b', size: 2, hash: sha256('ab') }, { reference: 'a', size: 1, hash: sha256('c') }];
    assert.equal(buildManifest('opaque', files), buildManifest('opaque', [...files].reverse()));
    assert.notEqual(sha256(buildManifest('opaque', files)), sha256(buildManifest('opaque', [{ ...files[0], hash: sha256('cd') }])));
});
