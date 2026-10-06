import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/services/forexFactory.js",
  "src/components/news/NewsCalendar.jsx",
  "src/components/news/TradeNewsContext.jsx",
  "netlify/functions/forexfactory.js",
  "src/components/trades/TradeModal.jsx",
  "src/components/shared/Sidebar.jsx",
  "src/App.jsx",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Missing required news integration files:", missing.join(", "));
  process.exit(1);
}

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["official weekly JSON feed", read("src/services/forexFactory.js").includes("https://nfs.faireconomy.media/ff_calendar_thisweek.json")],
  ["high-impact filtering", read("src/services/forexFactory.js").includes("impact").valueOf() && read("src/services/forexFactory.js").includes("isHighImpact")],
  ["trade-window matching", read("src/services/forexFactory.js").includes("getNewsForTrade")],
  ["local cache", read("src/services/forexFactory.js").includes("localStorage")],
  ["Netlify proxy", read("netlify/functions/forexfactory.js").includes("nfs.faireconomy.media")],
  ["trade modal news context", read("src/components/trades/TradeModal.jsx").includes("TradeNewsContext")],
  ["news checklist key", read("src/components/trades/TradeModal.jsx").includes("news_checked")],
  ["news navigation", /\["news",\s*Newspaper/.test(read("src/components/shared/Sidebar.jsx"))],
  ["news view routing", read("src/App.jsx").includes('view === "news"')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error("News integration checks failed:", failed.join(", "));
  process.exit(1);
}

console.log(`News integration QA passed: ${required.length} required files present; ${checks.length} integration checks passed.`);
