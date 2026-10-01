import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/hooks/useRiskManagement.js",
  "src/components/analytics/RiskManager.jsx",
  "src/components/trades/tradeUtils.js",
  "src/components/shared/Sidebar.jsx",
  "src/App.jsx",
  "package.json",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required risk files: ${missing.join(", ")}`);
  process.exit(1);
}
const hook = fs.readFileSync(path.join(root, "src/hooks/useRiskManagement.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/components/analytics/RiskManager.jsx"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/components/shared/Sidebar.jsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const checks = [
  [/calculatePositionRisk/, "position risk calculator"],
  [/stopPoints/, "stop distance"],
  [/targetPoints/, "target distance"],
  [/risk:/, "dollar risk"],
  [/rr:/, "risk reward"],
  [/maxQty/, "max quantity"],
  [/dailyUsed/, "daily risk tracking"],
  [/view === "risk"/, "risk view route"],
  [/Risk Manager/, "risk manager navigation"],
  [/RiskManager/, "risk manager component"],
];
const failed = checks.filter(([re, label]) => !re.test(`${hook}\n${ui}\n${sidebar}\n${app}`));
if (failed.length) {
  console.error(`Risk management QA failed: ${failed.map(([, label]) => label).join(", ")}`);
  process.exit(1);
}
console.log(`Risk management QA passed: ${required.length} required files present; ${checks.length} risk checks passed.`);
