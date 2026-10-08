const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
const exportsObject = {};
runInNewContext(ts.transpileModule(
    readFileSync(join(__dirname, "../src/lib/csv.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: exportsObject });
const { serializeCsv } = exportsObject;

test("CSV preserves commas, quotes, newlines and Unicode names", () => {
    assert.equal(serializeCsv([["Buyer", "Product"], ["林, Ali", 'Kit "Pro"\nEdition']]), '\uFEFF"Buyer","Product"\r\n"林, Ali","Kit ""Pro""\nEdition"');
});

test("CSV neutralises spreadsheet formulas including leading whitespace", () => {
    for (const value of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1+1", "\t=1+1", "\n=1+1"]) {
        assert.equal(serializeCsv([[value]]), `\uFEFF"'${value}"`);
    }
    assert.equal(serializeCsv([["45.50", "Normal product"]]), '\uFEFF"45.50","Normal product"');
});
