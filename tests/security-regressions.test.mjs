// Static guards for the audit fixes. These do NOT replace running the SQL against a real
// Supabase project (see AUDIT_FIXES_2026-09-29.md), but they stop the known bugs coming back.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../netlify/functions/tradovate-oauth-callback.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// TL-003: no script breakout from OAuth callback query params
const res = await handler(new Request("https://x.test/cb?error=x&error_description=" + encodeURIComponent("</script><script>window.__x=1</script>")));
const html = await res.text();
assert.ok(!html.includes("</script><script>"), "OAuth callback must escape < in inline JSON");

// TL-004 / TL-001: v3 migration
const sql = read("supabase/migrations/20260929_write_path_and_account_fixes.sql");
assert.ok(!/on conflict \(id\)/i.test(sql.replace(/--.*$/gm, "")), "save RPCs must not upsert on client id");
assert.ok(/t\.id = \$2 and t\.user_id = \$3/.test(sql), "trade update must be scoped to the owner");
assert.ok(/not v_is_update and v_operation_id is not null/.test(sql), "op-id shortcut must be insert-only");

// TL-001: modals never reuse a stored operation id
assert.ok(!/trade\?\.clientOperationId \|\| trade\?\.client_operation_id/.test(read("src/components/trades/TradeModal.jsx")));

// TL-005: no silent primary fallback when saving or reading trades
const supa = read("src/supabase.js");
assert.ok(!/if \(resolved\.uuid\) return "";\s*return "primary";/.test(supa));
assert.ok(!/accountId: row\.account_id \|\| "primary"/.test(supa));
assert.ok(!/account_id: trade\.accountId \|\| trade\.account_id \|\| "primary"/.test(supa));

// TL-006: All Accounts must not default to active-only
assert.ok(/dashboardAccountStatusFilter, setDashboardAccountStatusFilter\] = useState\("all"\)/.test(read("src/App.jsx")));
console.log("security-regression guards passed");
