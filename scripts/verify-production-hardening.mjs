import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const supabaseSource = fs.readFileSync(path.join(root, "src/supabase.js"), "utf8");
const migrationPath = path.join(root, "supabase/migrations/20260926_production_hardening.sql");
const migration = fs.readFileSync(migrationPath, "utf8");
const migrationV2 = fs.readFileSync(path.join(root, "supabase/migrations/20260926_production_hardening_v2.sql"), "utf8");
const remediation = fs.readFileSync(path.join(root, "supabase/migrations/20260929_production_remediation.sql"), "utf8");
const headers = fs.readFileSync(path.join(root, "netlify/_headers"), "utf8");

const checks = [
  ["atomic trade RPC migration", migration.includes("tradelog_save_trade_with_mistakes")],
  ["RPC is SECURITY DEFINER", /security\s+definer/i.test(migration)],
  ["RPC verifies auth.uid", migration.includes("auth.uid()")],
  ["RPC verifies account ownership", migration.includes("a.user_id = v_user_id") && migration.includes("a.account_id = v_account_id")],
  ["RPC verifies account UUID pairing", migration.includes("a.id = v_account_uuid") && migration.includes("a.account_id = v_account_id")],
  ["RPC performs concurrency check server-side", migration.includes("for update") && migration.includes("p_expected_updated_at")],
  ["RPC replaces mistakes in same transaction", migration.includes("delete from public.trade_mistakes") && migration.includes("insert into public.trade_mistakes")],
  ["client uses atomic trade RPC", /supabase\.rpc\(\s*"tradelog_save_trade_with_mistakes"/.test(supabaseSource)],
  ["client no longer performs separate mistake delete", !supabaseSource.includes('from("trade_mistakes").delete()\n    .eq("trade_id", tradeId);')],
  ["trade images bucket forced private", migration.includes("update storage.buckets set public = false where id = 'trade-images'")],
  ["trade image select policy", migration.includes("tradelog_trade_images_select_own")],
  ["trade image insert policy", migration.includes("tradelog_trade_images_insert_own")],
  ["trade image update policy", migration.includes("tradelog_trade_images_update_own")],
  ["trade image delete policy", migration.includes("tradelog_trade_images_delete_own")],
  ["transport security remains enabled", headers.includes("Strict-Transport-Security")],
  ["CSP is enforced", headers.includes("Content-Security-Policy:") && !headers.includes("Content-Security-Policy-Report-Only:")],
  ["Dashboard aggregate RPC migration", remediation.includes("tradelog_dashboard_summary")],
  ["Release schema verification RPC", remediation.includes("tradelog_verify_release_schema")],
  ["Connector account defaults removed", remediation.includes("alter column account_id drop default")],
  ["idempotent trade column/index", migrationV2.includes("client_operation_id") && migrationV2.includes("trades_user_client_operation_unique_idx")],
  ["idempotent missed-trade column/index", migrationV2.includes("missed_trades_user_client_operation_unique_idx")],
  ["server account ownership trigger", migrationV2.includes("tradelog_validate_account_reference")],
  ["trade image parent ownership trigger", migrationV2.includes("tradelog_validate_trade_image_link")],
  ["atomic missed-trade RPC", migrationV2.includes("tradelog_save_missed_trade")],
  ["atomic trade delete RPC", migrationV2.includes("tradelog_delete_trade")],
  ["atomic missed-trade delete RPC", migrationV2.includes("tradelog_delete_missed_trade")],
  ["transient retry helper", supabaseSource.includes("withSupabaseRetry") && supabaseSource.includes("RETRYABLE_STATUS_CODES")],
  ["UI save lock", fs.readFileSync(path.join(root, "src/components/trades/TradeModal.jsx"), "utf8").includes("saving") && fs.readFileSync(path.join(root, "src/components/missed/MissedTradeModal.jsx"), "utf8").includes("saving")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Production hardening QA failed: ${failed.map(([name]) => name).join(", ")}`);
  process.exit(1);
}

console.log(`Production hardening QA passed: ${checks.length}/${checks.length} checks.`);
