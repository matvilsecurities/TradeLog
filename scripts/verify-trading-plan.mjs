import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/hooks/useTradingPlan.js",
  "src/components/analytics/TradingPlan.jsx",
  "src/App.jsx",
  "src/components/shared/Sidebar.jsx",
];
const checks = [
  ["trading plan hook", "src/hooks/useTradingPlan.js", "useTradingPlan"],
  ["daily risk input", "src/components/analytics/TradingPlan.jsx", "maxRisk"],
  ["daily trade limit", "src/components/analytics/TradingPlan.jsx", "maxTrades"],
  ["plan persistence", "src/hooks/useTradingPlan.js", "localStorage"],
  ["app route", "src/App.jsx", 'view === "plan"'],
  ["sidebar route", "src/components/shared/Sidebar.jsx", '[\"plan\", Target'],
  ["today summary", "src/components/analytics/TradingPlan.jsx", "todayTrades"],
  ["rules confirmation", "src/components/analytics/TradingPlan.jsx", "rulesConfirmed"],
  ["Dashboard KPI language", "src/components/analytics/TradingPlan.jsx", "trading-plan-kpi"],
  ["market bias dropdown", "src/components/analytics/TradingPlan.jsx", "BIAS_OPTIONS"],
  ["Supabase persistence hook", "src/hooks/useTradingPlan.js", "trading_plans"],
  ["theme bridge", "src/components/analytics/TradingPlan.jsx", "data-theme={theme}"],
];
for (const f of required) if (!fs.existsSync(path.join(root, f))) throw new Error(`Missing ${f}`);
for (const [label, file, token] of checks) if (!fs.readFileSync(path.join(root, file), "utf8").includes(token)) throw new Error(`Missing check: ${label}`);
console.log(`Trading plan QA passed: ${required.length} required files present; ${checks.length} plan checks passed.`);
