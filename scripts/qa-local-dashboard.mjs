import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let report = {
  generatedAt: new Date().toISOString(),
  purpose: "TradeLog local QA dashboard",
  checks: [
    ["Source syntax/import audit", "Run npm run verify:all"],
    ["Production build", "Run npm run build"],
    ["Manual CRUD", "Create/edit/delete a test trade and verify Supabase"],
    ["Multi-account isolation", "Verify each trade retains its canonical account"],
    ["UI regression", "Open Dashboard, Journal, Analysis, Calendar, Prop Firm Setup, Data Center"],
    ["Broker synchronization", "Disabled intentionally for this release; planned for a later phase"],
  ],
};
try { report = JSON.parse(fs.readFileSync(path.join(root, "qa", "latest-report.json"), "utf8")); } catch {}
const html = `<!doctype html><html><head><meta charset="utf-8"><title>TradeLog QA</title><style>body{font-family:Inter,system-ui,sans-serif;background:#f7f7fb;color:#18181b;margin:0;padding:32px}main{max-width:920px;margin:auto}h1{margin:0 0 8px}.sub{color:#71717a}.card{background:white;border:1px solid #e4e4e7;border-radius:16px;padding:18px;margin-top:16px}.row{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid #eee}.row:last-child{border:0}.tag{font-size:12px;font-weight:700;padding:4px 8px;border-radius:999px;background:#f1f5f9}.disabled{background:#fff7ed;color:#9a3412}.cmd{font-family:ui-monospace,monospace;background:#18181b;color:#fff;padding:12px;border-radius:10px;display:inline-block;margin-top:8px}</style></head><body><main><h1>TradeLog QA Dashboard</h1><div class="sub">Local verification workspace · ${report.generatedAt}</div><div class="card"><h2>Latest deep QA</h2><p><strong>${report.summary?.passed ?? "—"}</strong> passed / <strong>${report.summary?.failed ?? "—"}</strong> failed / ${report.summary?.total ?? "—"} total</p>${(report.results||[]).map((r)=>`<div class="row"><div><strong>${r.name}</strong><div class="sub">${r.detail||""}</div></div><span class="tag ${r.status==="FAIL"?"disabled":""}">${r.status}</span></div>`).join("")}</div><div class="card"><h2>Run locally</h2><div class="cmd">npm run verify:all</div><br><div class="cmd">npm run build</div></div><div class="card"><h2>Release policy</h2><p>Broker synchronization and live execution capture are intentionally disabled in this build. Manual journaling, account management, analytics, risk, calendar and backup workflows remain the active product surface.</p></div></main></body></html>`;
http.createServer((req,res)=>{res.writeHead(200,{"Content-Type":"text/html; charset=utf-8"});res.end(html)}).listen(Number(process.env.PORT||4173),"127.0.0.1",()=>console.log(`TradeLog QA dashboard: http://127.0.0.1:${process.env.PORT||4173}`));
