import assert from "node:assert/strict";
import { calculateEquityState, calculatePropFirmCompliance } from "../src/services/propFirmCompliance.js";

const settings = { accountSize: 25000, propRules: { drawdownType: "Intraday trailing", maxDrawdown: 1500 } };
const asc = [
  { id: 1, date: "2026-09-01", pnl: 1000 },
  { id: 2, date: "2026-09-02", pnl: -500 },
];
const perms = [asc, [...asc].reverse()];
for (const list of perms) {
  const e = calculateEquityState(list, settings);
  assert.equal(e.currentEquity, 25500);
  assert.equal(e.highWaterMark, 26000, "HWM must not depend on input order");
  assert.equal(e.currentDrawdown, 500);
}
// new high -> drop -> higher high, shuffled
const seq = [
  { id: "a", date: "2026-09-01", time: "09:30", pnl: 500 },
  { id: "b", date: "2026-09-01", time: "10:30", pnl: -200 },
  { id: "c", date: "2026-09-02", time: "09:30", pnl: 900 },
  { id: "d", date: "2026-09-03", time: "09:30", pnl: -100 },
];
const expected = calculateEquityState(seq, settings);
assert.equal(expected.highWaterMark, 25000 + 500 - 200 + 900);
assert.equal(expected.currentDrawdown, 100);
for (const shuffled of [[seq[3], seq[1], seq[0], seq[2]], [...seq].reverse()]) {
  assert.deepEqual(calculateEquityState(shuffled, settings), expected);
}
// same-day trades ordered by time
const sameDay = [{ id: 2, date: "2026-09-01", time: "11:00", pnl: -300 }, { id: 1, date: "2026-09-01", time: "09:00", pnl: 400 }];
assert.equal(calculateEquityState(sameDay, settings).highWaterMark, 25400);
// zero trades / trailing threshold
const c = calculatePropFirmCompliance(asc, settings);
assert.equal(c.trailingThreshold, 26000 - 1500);
assert.equal(calculateEquityState([], settings).currentEquity, 25000);
console.log("equity-order tests passed");
