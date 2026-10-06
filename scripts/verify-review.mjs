import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/components/analytics/TradeReview.jsx",
  "src/components/shared/Sidebar.jsx",
  "src/App.jsx",
  "package.json",
];
const checks = [
  ["TradeReview imported", /TradeReview = lazy|import TradeReview|components\/analytics\/TradeReview/.test(fs.readFileSync(path.join(root,"src/App.jsx"),"utf8"))],
  ["Review route wired", /view === ["']review["']/.test(fs.readFileSync(path.join(root,"src/App.jsx"),"utf8"))],
  ["Sidebar review item", /Trade Review/.test(fs.readFileSync(path.join(root,"src/components/shared/Sidebar.jsx"),"utf8"))],
  ["Outcome filters", /Win.*Loss.*BE/s.test(fs.readFileSync(path.join(root,"src/components/analytics/TradeReview.jsx"),"utf8"))],
  ["Grade filters", /A\+.*A.*B.*C.*D/s.test(fs.readFileSync(path.join(root,"src/components/analytics/TradeReview.jsx"),"utf8"))],
  ["Mistake review", /selectedMistakes|Mistakes/.test(fs.readFileSync(path.join(root,"src/components/analytics/TradeReview.jsx"),"utf8"))],
  ["Screenshot review", /screenshot_before.*screenshot_after/s.test(fs.readFileSync(path.join(root,"src/components/analytics/TradeReview.jsx"),"utf8"))],
  ["Notes review", /getTradeNotes/.test(fs.readFileSync(path.join(root,"src/components/analytics/TradeReview.jsx"),"utf8"))],
];
const missing = required.filter((f)=>!fs.existsSync(path.join(root,f)));
if (missing.length) { console.error(`Missing required review files: ${missing.join(", ")}`); process.exit(1); }
const failed=checks.filter(([,ok])=>!ok).map(([name])=>name);
if(failed.length){console.error(`Review QA failed: ${failed.join(", ")}`);process.exit(1);}
console.log(`Trade review QA passed: ${required.length} required files present; ${checks.length} review checks passed.`);
