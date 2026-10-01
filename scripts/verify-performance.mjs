import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/hooks/usePerformanceStats.js",
  "src/components/analytics/Analytics.jsx",
  "src/components/analytics/CalendarView.jsx",
  "src/components/analytics/DayDetail.jsx",
  "src/components/analytics/EdgeAnalysis.jsx",
  "src/App.jsx",
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required performance files:", missing.join(", "));
  process.exit(1);
}

const hook = fs.readFileSync(path.join(root, "src/hooks/usePerformanceStats.js"), "utf8");
const analytics = fs.readFileSync(path.join(root, "src/components/analytics/Analytics.jsx"), "utf8");
const edge = fs.readFileSync(path.join(root, "src/components/analytics/EdgeAnalysis.jsx"), "utf8");
const dayDetail = fs.readFileSync(path.join(root, "src/components/analytics/DayDetail.jsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");

const checks = [
  ["hook exports usePerformanceStats", /export function usePerformanceStats/.test(hook)],
  ["hook exposes equity curve", /equityCurve/.test(hook)],
  ["hook exposes setup performance", /setupPerformance/.test(hook)],
  ["hook exposes symbol performance", /symbolPerformance/.test(hook)],
  ["hook exposes session performance", /sessionPerformance/.test(hook)],
  ["Analytics uses shared performance hook", /usePerformanceStats/.test(analytics)],
  ["Edge Analysis uses shared performance hook", /usePerformanceStats/.test(edge)],
  ["Day Detail uses shared performance hook", /usePerformanceStats/.test(dayDetail)],
  ["App uses shared performance hook", /usePerformanceStats/.test(app)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error("Performance architecture verification failed:");
  for (const [label] of failed) console.error(`- ${label}`);
  process.exit(1);
}

console.log(`Performance architecture QA passed: ${required.length} required files present; ${checks.length} shared-stat checks passed.`);
