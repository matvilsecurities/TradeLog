import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'src/hooks/useLiveTradeCapture.js',
  'src/services/operations/executionAggregator.js',
  'src/components/apex/TradingOperationsCenter.jsx',
  'supabase/migrations/20260920_live_trade_capture.sql',
  'ninjatrader/TradeLogBridgeAddOn/TradeLogBridgeAddOn.cs',
];
for (const rel of required) if (!fs.existsSync(path.join(root, rel))) throw new Error(`Missing required Phase 39 file: ${rel}`);

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const hook = read('src/hooks/useLiveTradeCapture.js');
const agg = read('src/services/operations/executionAggregator.js');
const ui = read('src/components/apex/TradingOperationsCenter.jsx');
const sql = read('supabase/migrations/20260920_live_trade_capture.sql');
const cs = read('ninjatrader/TradeLogBridgeAddOn/TradeLogBridgeAddOn.cs');
const app = read('src/App.jsx');
const supabase = read('src/supabase.js');

const checks = [
  ['execution IDs are normalized', /executionId/.test(agg) && /normalizeExecution/.test(agg)],
  ['FIFO scale-in/scale-out aggregation exists', /remainingQty/.test(agg) && /entryNotional/.test(agg) && /exitNotional/.test(agg)],
  ['partial and final lifecycle states exist', /status = remaining > 0 \? "partial" : "closed"/.test(agg) && /captureStatus/.test(agg)],
  ['reversal handling creates a new opposite journal', /closingSide/.test(agg) && /openIntoJournal/.test(agg)],
  ['duplicate execution protection exists', /processedIds/.test(agg) && /duplicate/.test(agg)],
  ['position reconciliation exists', /reconcileExecutionState/.test(agg) && /capturedQty/.test(agg)],
  ['live WebSocket capture is implemented', /new WebSocket/.test(hook) && /\/events/.test(hook)],
  ['durable execution persistence is implemented', /saveTradeExecutionDb/.test(hook) && /fetchTradeExecutionsDb/.test(hook)],
  ['auto-capture UI exists', /Live Trade Capture/.test(ui) && /Enable auto-capture/.test(ui)],
  ['trade execution ledger migration exists', /create table if not exists public\.trade_executions/.test(sql) && /trade_executions.*external_execution_id/.test(sql.replace(/\s+/g, ' '))],
  ['trade RLS exists for execution ledger', /trade_executions_select_own/.test(sql) && /trade_executions_insert_own/.test(sql)],
  ['NinjaTrader sends order action', /OrderAction/.test(cs) && /action =/.test(cs)],
  ['App wires live capture to active account', /useLiveTradeCapture/.test(app) && /liveCapture=\{liveCapture\}/.test(app)],
  ['Supabase stores execution metadata on live trades', /execution_ids/.test(supabase) && /capture_status/.test(supabase) && /live_trade_key/.test(supabase)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) throw new Error(`Phase 39 QA failed: ${failed.map(([name]) => name).join('; ')}`);
console.log(`Live trade capture QA passed: ${required.length} required files present; ${checks.length} capture checks passed.`);
