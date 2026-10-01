import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const required=['tools/nt8-bridge/server.mjs','tools/nt8-bridge/README.md','PHASE38_LIVE_BROKER_INTEGRATION.md','src/components/apex/TradingOperationsCenter.jsx','src/hooks/useLiveTradeCapture.js'];
for(const f of required) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing required file: ${f}`);
const read=f=>fs.readFileSync(path.join(root,f),'utf8'); const bridge=read(required[0]), ui=read(required[3]), capture=read(required[4]);
const checks=[bridge.includes("url.pathname === '/health'"),bridge.includes("url.pathname === '/snapshot'"),bridge.includes("url.pathname === '/ingest'"),bridge.includes('101 Switching Protocols'),ui.includes('Live Trade Capture'),capture.includes('new WebSocket'),capture.includes('/events'),capture.includes('saveTradeExecutionDb'),!capture.match(/placeOrder|cancelOrder|liquidate/i)];
if(checks.some(v=>!v)) throw new Error('Live broker QA failed: current read-only bridge/live-capture contract is incomplete');
console.log(`Live broker QA passed: ${required.length} required files present; ${checks.length} checks passed.`);
