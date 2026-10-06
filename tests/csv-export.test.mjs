import assert from "node:assert/strict";
import { escapeCsvValue, rowsToCsv } from "../src/utils/csv.js";

assert.equal(escapeCsvValue("hello"), "hello");
assert.equal(escapeCsvValue("hello,world"), '"hello,world"');
assert.equal(escapeCsvValue('say "hello"'), '"say ""hello"""');
assert.equal(escapeCsvValue("line1\nline2"), '"line1\nline2"');
assert.equal(escapeCsvValue(null), "");
assert.equal(escapeCsvValue(undefined), "");
assert.equal(escapeCsvValue({ a: 1 }), '"{""a"":1}"');
assert.equal(rowsToCsv([{ name: 'A, "quoted"', pnl: 100 }], ["name", "pnl"]), 'name,pnl\n"A, ""quoted""",100');
console.log("CSV export regression tests passed");
