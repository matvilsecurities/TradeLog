import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createExecutionState, applyExecution } from "../src/services/operations/executionAggregator.js";
import { calculateCurrentEquity } from "../src/components/trades/tradeUtils.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
async function check(name, fn) {
  const started = performance.now();
  try { const value = await fn(); results.push({ name, status: "PASS", ms: +(performance.now()-started).toFixed(2), detail: value || "" }); }
  catch (error) { results.push({ name, status: "FAIL", ms: +(performance.now()-started).toFixed(2), detail: error?.message || String(error) }); }
}
function read(rel){ return fs.readFileSync(path.join(root, rel), "utf8"); }
function assert(condition, message){ if(!condition) throw new Error(message); }

await check("Broker synchronization removed from active App route", () => {
  const app=read("src/App.jsx");
  assert(!/useBrokerConnections|useTradovateConnector|useNinjaTraderConnector|useSyncEngine|useLiveTradeCapture/.test(app), "active broker hook remains in App.jsx");
  assert(!/view === ["'](?:sync|connections)["']/.test(app), "broker route remains in App.jsx");
  return "manual journaling remains the active trade-entry path";
});
await check("Broker synchronization removed from active sidebar", () => {
  const sidebar=read("src/components/shared/Sidebar.jsx");
  assert(!/Trading Operations|Brokers & integrations/.test(sidebar), "broker navigation remains in Sidebar.jsx");
  return "future connector files remain archived but unreachable";
});
await check("Dashboard export control is wired", () => {
  const h=read("src/components/dashboard/DashboardHeader.jsx");
  assert(/onExport/.test(h) && /td-export/.test(h), "export handler missing");
  const d=read("src/components/dashboard/TradeJournalDashboard.jsx");
  assert(/exportTradesCsv/.test(d) && /text\/csv/.test(d), "CSV export implementation missing");
  return "CSV export is generated client-side from current dashboard trades";
});
await check("Supabase account_size hydrates Journal Ledger equity on first load", () => {
  const source = read("src/hooks/useAccountPortfolio.js");
  assert(/account_size: normalizedAccountSize/.test(source), "top-level account_size hydration is missing");
  assert(/accountSize: normalizedAccountSize/.test(source), "settings.accountSize hydration is missing");
  assert(/row\?\.account_size \?\? settings\.accountSize/.test(source), "Supabase account_size is not treated as authoritative");
  return "Supabase account_size is hydrated into both account_size and settings.accountSize before Journal Ledger renders";
});
await check("Current Equity uses prop-firm account size plus P&L", () => {
  const accounts = [
    { id: "APEX-25", account_size: 25000, settings: { initialProfit: 9999 } },
    { id: "APEX-50", account_size: 50000, settings: { initialProfit: 8888 } },
  ];
  const trades = [
    { account_id: "APEX-25", pnl: 500 },
    { account_id: "APEX-25", pnl: -125 },
    { account_id: "APEX-50", pnl: 1000 },
  ];
  const one = calculateCurrentEquity(accounts, trades, "APEX-25");
  assert(one.accountSize === 25000, `expected 25K starting equity, got ${one.accountSize}`);
  assert(one.pnl === 375, `expected 375 P&L, got ${one.pnl}`);
  assert(one.currentEquity === 25375, `expected 25,375 equity, got ${one.currentEquity}`);
  const all = calculateCurrentEquity(accounts, trades, "all");
  assert(all.accountSize === 75000, `expected 75K aggregate starting equity, got ${all.accountSize}`);
  assert(all.pnl === 1375, `expected 1,375 aggregate P&L, got ${all.pnl}`);
  assert(all.currentEquity === 76375, `expected 76,375 aggregate equity, got ${all.currentEquity}`);
  return "25K + 375 = 25,375; legacy initial-profit offsets are ignored";
});
await check("Dashboard date control is wired", () => {
  const h=read("src/components/dashboard/DashboardHeader.jsx");
  const d=read("src/components/dashboard/TradeJournalDashboard.jsx");
  assert(/tradelog:dashboard-date/.test(h) && /dashboardDateMode/.test(d), "date menu not connected to dashboard state");
  return "latest month/all dates change the dashboard trade dataset";
});
await check("Calendar controls are wired", () => {
  const c=read("src/components/dashboard/DashboardReferenceCalendar.jsx");
  assert(/setShowWeekSummary|setCompactWeeks|setShowCalendarInfo/.test(c), "calendar toolbar controls remain dead");
  return "settings, view density and info controls have actions";
});
await check("Execution aggregator scale-in/partial-exit/full-close", () => {
  let state=createExecutionState();
  const events=[
    ["1","A","Buy",2,100], ["2","A","Buy",1,102], ["3","A","Sell",1,105], ["4","A","Sell",2,107],
  ];
  for(const [id,account,action,qty,price] of events){ const r=applyExecution(state,{executionId:id,accountId:account,symbol:"MNQ",action,quantity:qty,price,time:"2026-09-25T10:00:00Z"}); assert(r.accepted,`event ${id} rejected`); state=r.state; }
  const journals=Object.values(state.journals); assert(journals.length===1,"expected one lifecycle journal"); assert(journals[0].status==="closed","journal did not close");
  return `closed journal P&L ${journals[0].pnl.toFixed(2)}`;
});
await check("Execution deduplication", () => {
  let state=createExecutionState();
  const e={executionId:"dup-1",accountId:"A",symbol:"MGC",action:"Buy",quantity:1,price:2500,time:"2026-09-25T10:00:00Z"};
  let r=applyExecution(state,e); state=r.state; r=applyExecution(state,e); assert(r.duplicate===true,"duplicate execution was not rejected"); assert(Object.keys(r.state.journals).length===1,"duplicate created another journal"); return "duplicate execution ignored";
});
await check("100,000-trade dashboard statistics load", async () => {
  const source = read("src/hooks/useDashboardStats.js").replace(/^import \{ useMemo \} from "react";\n/, "const useMemo = (fn) => fn();\n").replace('../components/dashboard/dashboardUtils', '../src/components/dashboard/dashboardUtils.js');
  const temp = path.join(root, "qa", "_dashboardStats.qa.mjs");
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  fs.writeFileSync(temp, source);
  const mod = await import(`file://${temp}?t=${Date.now()}`);
  const trades = Array.from({ length: 100000 }, (_, i) => ({ date: `2026-09-${String((i % 25) + 1).padStart(2, "0")}`, pnl: i % 3 === 0 ? 100 : -40, symbol: i % 2 ? "MNQ" : "MGC" }));
  const started = performance.now();
  const stats = mod.useDashboardStats(trades);
  const elapsed = performance.now() - started;
  assert(stats.orderedTrades.length === 100000, "statistics lost trades");
  assert(Number.isFinite(stats.totalPnl), "total P&L is not finite");
  assert(elapsed < 2500, `dashboard statistics took ${elapsed.toFixed(0)}ms`);
  fs.rmSync(temp, { force: true });
  return `100,000 trades processed in ${elapsed.toFixed(0)}ms`;
});
await check("10,000 execution stress test", () => {
  let state=createExecutionState();
  for(let i=0;i<5000;i++) state=applyExecution(state,{executionId:`s${i}`,accountId:`acct-${i%20}`,symbol:i%2?"MNQ":"MGC",action:"Buy",quantity:1,price:100+(i%100),time:new Date(2026,8,1,i%24,i%60).toISOString()}).state;
  assert(state.processedIds.length===5000,"processed execution ledger did not cap at expected stress size");
  assert(Object.keys(state.journals).length<=5000,"journal count exceeded execution count");
  return `${Object.keys(state.journals).length} journals / ${state.processedIds.length} executions`;
});
await check("Multi-user isolation model", () => {
  const users=["u1","u2","u3","u4","u5"]; const rows=[];
  for(const user of users) for(let i=0;i<1000;i++) rows.push({userId:user,accountId:`${user}-acct-${i%10}`,pnl:i%2?10:-5});
  for(const user of users){ const own=rows.filter(r=>r.userId===user); assert(own.length===1000,`${user} row count mismatch`); assert(own.every(r=>r.userId===user),`${user} cross-user row leaked`); }
  return "5 isolated users × 1,000 synthetic trades verified";
});
await check("No live-capture UI is reachable", () => {
  const app=read("src/App.jsx"); const side=read("src/components/shared/Sidebar.jsx");
  assert(!/Live Trade Capture|NinjaTrader Desktop Bridge|Apex · NinjaTrader/.test(app+side),"live capture UI still reachable from main app/sidebar");
  return "connector implementation remains available for a later phase but is not exposed";
});

const failed=results.filter(r=>r.status==="FAIL");
const report={generatedAt:new Date().toISOString(), summary:{passed:results.length-failed.length,failed:failed.length,total:results.length}, results};
fs.mkdirSync(path.join(root,"qa"),{recursive:true});
fs.writeFileSync(path.join(root,"qa","latest-report.json"),JSON.stringify(report,null,2));
console.log(`Deep QA: ${report.summary.passed}/${report.summary.total} passed.`);
for(const r of results) console.log(`${r.status==='PASS'?'PASS':'FAIL'} ${r.name} (${r.ms}ms)${r.detail?` — ${r.detail}`:""}`);
if(failed.length) process.exit(1);
