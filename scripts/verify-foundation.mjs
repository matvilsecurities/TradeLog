import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const required = [
  "src/supabase.js",
  "src/hooks/useAccountPortfolio.js",
  "src/services/propFirmCompliance.js",
  "src/hooks/useLiveTradeCapture.js",
  "supabase/migrations/20260924_foundation_accounts.sql",
  "FOUNDATION_FIXES_2026-09-24.md",
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing foundation file: ${file}`);

const supabase = read("src/supabase.js");
const portfolio = read("src/hooks/useAccountPortfolio.js");
const compliance = read("src/services/propFirmCompliance.js");
const migration = read("supabase/migrations/20260924_foundation_accounts.sql");
const live = read("src/hooks/useLiveTradeCapture.js");

const checks = [
  ["Supabase session persists", supabase.includes("persistSession: true")],
  ["accounts table API exists", supabase.includes("fetchAccountsDb") && supabase.includes("saveAccountDb")],
  ["account creation persists", portfolio.includes("createAccountDb") && portfolio.includes("persistAccount(account)")],
  ["account archive is durable", portfolio.includes("archiveAccountDb")],
  ["browser storage is cache only", portfolio.includes("fetchAccountsDb") && portfolio.includes("CACHE_PREFIX")],
  ["accounts migration exists", migration.includes("create table if not exists public.accounts")],
  ["account RLS exists", migration.includes("accounts_select_own") && migration.includes("accounts_update_own")],
  ["missed trades are account scoped", migration.includes("alter table public.missed_trades") && migration.includes("account_id")],
  ["micro contract metadata exists", compliance.includes("MNQ") && compliance.includes('contractType: "micro"')],
  ["micro and full contract limits are separated", compliance.includes("maxMicrosExceeded") && compliance.includes("maxContractsExceeded")],
  ["account timezone is used", compliance.includes("accountTimezone") && compliance.includes("timeZone: timezone")],
  ["rule version warning exists", compliance.includes("rule-version")],
  ["live executions persist", live.includes("saveTradeExecutionDb")],
  ["live bridge is read-only", live.includes("/events") && !/placeOrder|cancelOrder|liquidate/i.test(live)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) throw new Error(failed.map(([name]) => `Foundation check failed: ${name}`).join("\n"));
console.log(`TradeLog foundation QA passed: ${checks.length}/${checks.length} checks.`);
