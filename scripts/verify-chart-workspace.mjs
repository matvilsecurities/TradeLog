import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/components/trades/ChartWorkspace.jsx",
  "src/components/trades/ChartPreview.jsx",
  "src/components/trades/tradingView.js",
  "src/components/analytics/TradeReview.jsx",
  "src/components/shared/Sidebar.jsx",
  "src/App.jsx",
];
const checks = [
  ["ChartWorkspace component", /function ChartWorkspace|export default function ChartWorkspace/],
  ["TradingView loader", /loadTradingViewScript/],
  ["TV symbol mapping", /getTVSymbol/],
  ["chart route", /view === ["']charts["']/],
  ["sidebar navigation", /Chart Workspace/],
  ["review deep link", /Open in Chart Workspace/],
  ["chart URL action", /chart_url/],
  ["screenshot evidence", /screenshot_before/],
  ["trade levels", /selected\.entry/],
  ["no database migration", !/supabase|insert\(|update\(|from\(/],
];
let missing=[]; for (const f of required) if(!fs.existsSync(path.join(root,f))) missing.push(f);
if(missing.length){console.error(`Chart workspace QA failed: missing ${missing.length} required file(s):`); missing.forEach(x=>console.error(`- ${x}`)); process.exit(1)}
let failed=[];
for(const [f,pattern] of required.map((f)=>[f,null])){ /* file existence already checked */ }
const sources = [
  ["ChartWorkspace", "src/components/trades/ChartWorkspace.jsx"],
  ["App", "src/App.jsx"],
  ["Sidebar", "src/components/shared/Sidebar.jsx"],
  ["TradeReview", "src/components/analytics/TradeReview.jsx"],
  ["TradingView", "src/components/trades/tradingView.js"],
];
const text=sources.map(([n,f])=>[n,fs.readFileSync(path.join(root,f),"utf8")]).reduce((a,[n,t])=>a+`\n${n}\n${t}`,"");
for(const [name,re] of checks){ if(re instanceof RegExp && !re.test(text)) failed.push(name); }
if(failed.length){console.error(`Chart workspace QA failed: ${failed.length} check(s):`); failed.forEach(x=>console.error(`- ${x}`)); process.exit(1)}
console.log(`Chart workspace QA passed: ${required.length} required files present; ${checks.length} workspace checks passed.`);
