import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/components/apex/TradingOperationsCenter.jsx",
  "src/hooks/useTradingOperations.js",
  "src/services/operations/tradeLifecycle.js",
  "src/hooks/useLiveTradeCapture.js",
  "src/hooks/useSyncEngine.js",
  "src/services/sync/eventProcessor.js",
  "src/services/securityAudit.js",
  "PHASE33_37_UNIFIED_OPERATIONS.md",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(", ")}`);

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("src/App.jsx");
const sidebar = read("src/components/shared/Sidebar.jsx");
const center = read("src/components/apex/TradingOperationsCenter.jsx");
const lifecycle = read("src/services/operations/tradeLifecycle.js");
const checks = [
  ["Operations center component", center.includes("Trading Operations Center")],
  ["Overview tab", center.includes('"overview"')],
  ["Live risk tab", center.includes('"risk"')],
  ["Trade lifecycle tab", center.includes('"lifecycle"')],
  ["Intelligence tab", center.includes('"intelligence"')],
  ["Multi-account tab", center.includes('"accounts"')],
  ["NinjaTrader bridge tab", center.includes('"bridge"')],
  ["Lifecycle classifier", lifecycle.includes("classifyTradeLifecycle")],
  ["Lifecycle summary", lifecycle.includes("summarizeTradeLifecycle")],
  ["App operations route", app.includes("TradingOperationsCenter") && app.includes('view === "sync"')],
  ["Sidebar operations entry", sidebar.includes("Trading Operations")],
  ["Read-only bridge boundary", center.includes("read-only") && center.includes("does not submit orders")],
  ["No order placement", center.includes("does not automatically place")],
  ["Security audit retained", center.includes("runSecurityAudit")],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Unified operations QA failed: ${failed.join(", ")}`);
console.log(`Unified operations QA passed: ${required.length} required files present; ${checks.length} operations checks passed.`);
