import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/components/dashboard");
const required = [
  "TradeJournalDashboard.jsx",
  "DashboardHeader.jsx",
  "DashboardKpis.jsx",
  "DashboardCard.jsx",
  "PnlChart.jsx",
  "DailyPerformance.jsx",
  "RecentTrades.jsx",
  "DashboardReferenceCalendar.jsx",
  "ZellaScore.jsx",
  "dashboardUtils.js",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing dashboard files: ${missing.join(", ")}`);
  process.exit(1);
}

const source = required
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

const forbiddenDemoValues = ["Jun 20, 2024", "$1,180.00", "83.01"];
const foundDemoValues = forbiddenDemoValues.filter((value) => source.includes(value));
if (foundDemoValues.length) {
  console.error(`Demo values remain in dashboard sources: ${foundDemoValues.join(", ")}`);
  process.exit(1);
}

console.log(`Dashboard static QA passed: ${required.length} required files present; no known demo values found.`);
