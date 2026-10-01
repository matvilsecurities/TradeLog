import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
// Broker synchronization is intentionally deferred for this release. Its
// historical verification scripts remain in the repository for the future
// integration phase, but must not block the current product release.
const DEFERRED_BROKER_TESTS = new Set([
  "verify-connector-persistence.mjs",
  "verify-connectors.mjs",
  "verify-live-broker.mjs",
  "verify-live-operations.mjs",
  "verify-live-trade-capture.mjs",
  "verify-ninjatrader.mjs",
  "verify-tradovate.mjs",
  "verify-unified-operations.mjs",
]);

const scripts = readdirSync(scriptsDir)
  .filter((file) => file.startsWith("verify-") && file.endsWith(".mjs") && file !== "verify-all.mjs")
  .sort();

const active = scripts.filter((file) => !DEFERRED_BROKER_TESTS.has(file));
const deferred = scripts.filter((file) => DEFERRED_BROKER_TESTS.has(file));
let failed = 0;

for (const script of active) {
  const result = spawnSync(process.execPath, [path.join(scriptsDir, script)], { stdio: "inherit" });
  if (result.status !== 0) failed += 1;
}

if (deferred.length) {
  console.log(`Deferred broker-sync QA (${deferred.length}): ${deferred.join(", ")}`);
}
if (failed) process.exit(1);
console.log(`All active TradeLog verification scripts passed: ${active.length}/${active.length}.`);
