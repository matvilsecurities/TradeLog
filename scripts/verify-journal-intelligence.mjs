import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/hooks/useJournalIntelligence.js",
  "src/components/analytics/JournalIntelligence.jsx",
  "src/App.jsx",
  "src/components/shared/Sidebar.jsx",
  "src/services/forexFactory.js",
  "src/components/trades/tradeUtils.js",
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing required file: ${rel}`);
const hook=fs.readFileSync(path.join(root,"src/hooks/useJournalIntelligence.js"),"utf8");
const page=fs.readFileSync(path.join(root,"src/components/analytics/JournalIntelligence.jsx"),"utf8");
const app=fs.readFileSync(path.join(root,"src/App.jsx"),"utf8");
const sidebar=fs.readFileSync(path.join(root,"src/components/shared/Sidebar.jsx"),"utf8");
const checks=[
  [hook.includes("inferSession"),"automatic session inference"],
  [hook.includes("getNewsForTrade"),"news proximity tagging"],
  [hook.includes("Planned R:R") && hook.includes("rr < 3"),"R:R rule flag"],
  [hook.includes("setup_checklist") && hook.includes("mistakes"),"discipline flags"],
  [hook.includes("reviewQueue") && hook.includes("dailySummary"),"review queue and daily summary"],
  [hook.includes("quality"),"rule-based process score"],
  [page.includes("Automatic Review Queue") && page.includes("Daily Trading Summary"),"intelligence workspace UI"],
  [app.includes('view === "journalintelligence"'),"App route"],
  [sidebar.includes("Journal Intelligence"),"sidebar navigation"],
  [page.includes("do not predict trade outcomes"),"non-predictive wording"],
];
const failed=checks.filter(([ok])=>!ok);
if(failed.length) throw new Error(`Journal intelligence QA failed: ${failed.map(([,name])=>name).join(", ")}`);
console.log(`Journal intelligence QA passed: ${required.length} required files present; ${checks.length} intelligence checks passed.`);
