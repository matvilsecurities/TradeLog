import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "supabase/migrations/20260920_connector_persistence.sql",
  "src/supabase.js",
  "src/hooks/useBrokerConnections.js",
  "src/App.jsx",
  "PHASE25_CONNECTOR_PERSISTENCE.md",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Connector persistence QA failed: missing ${missing.join(", ")}`);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read(required[0]);
const supabase = read(required[1]);
const connections = read(required[2]);
const app = read(required[3]);
const checks = [
  ["Durable trade account ID", migration.includes("account_id text") && supabase.includes("account_id: trade.accountId")],
  ["Durable external trade ID", migration.includes("external_trade_id text") && supabase.includes("external_trade_id: trade.externalTradeId")],
  ["External connector provenance", migration.includes("connector_id text") && supabase.includes("connector_id: trade.connectorId")],
  ["Duplicate protection index", migration.includes("trades_connector_external_unique_idx")],
  ["Broker connection table", migration.includes("create table if not exists public.broker_connections")],
  ["Connector RLS", migration.includes("Users can read own broker connections") && migration.includes("auth.uid() = user_id")],
  ["Persistent connector restore", connections.includes("fetchBrokerConnectionsDb") && connections.includes("saveBrokerConnectionDb")],
  ["Secrets excluded from persistence", connections.includes("accessToken") && connections.includes("clientSecret") && connections.includes("password") && connections.includes("stripForPersistence")],
  ["Durable import dedupe", app.includes("fetchExistingExternalTradeIdsDb") && app.includes("externalTradeId")],
  ["Primary-account migration fallback", migration.includes("set account_id = 'primary'")],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Connector persistence QA failed: ${failed.join("; ")}`);
console.log(`Connector persistence QA passed: ${required.length} required files present; ${checks.length} persistence checks passed.`);
