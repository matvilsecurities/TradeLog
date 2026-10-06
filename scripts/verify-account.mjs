import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/hooks/useAccountCenter.js",
  "src/components/apex/AccountCenter.jsx",
  "src/components/apex/ApexSettings.jsx",
  "src/components/apex/ApexDashboard.jsx",
  "src/App.jsx",
  "src/components/shared/Sidebar.jsx",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) { console.error(`Missing required files:\n${missing.join("\n")}`); process.exit(1); }
const checks = [
  [/useAccountCenter\.js/, "hook"],
  [/currentEquity/, "equity"],
  [/availableDrawdown/, "available drawdown"],
  [/dailyLossRemaining/, "daily risk"],
  [/payoutEligible/, "payout status"],
  [/consistencyPct/, "consistency"],
  [/view === "account"/, "account route"],
  [/Account Center/, "account navigation"],
  [/Account Settings/, "settings navigation"],
  [/verify:account/, "package script"],
];
const files = required.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n") + fs.readFileSync(path.join(root, "package.json"), "utf8");
const failed = checks.filter(([rx]) => !rx.test(files));
if (failed.length) { console.error(`Failed checks:\n${failed.map(([,name])=>name).join("\n")}`); process.exit(1); }
console.log(`Account center QA passed: ${required.length} required files present; ${checks.length} account checks passed.`);
