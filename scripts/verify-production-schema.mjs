const url = String(process.env.SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !key) {
  console.log("Production schema verification skipped: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the release environment.");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase.rpc("tradelog_verify_release_schema");
if (error) {
  console.error(`Production schema verification failed: ${error.message}`);
  process.exit(1);
}

const checks = data?.checks || {};
const failed = Object.entries(checks).filter(([, value]) => value !== true);
console.log(`Production schema verification: ${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks passed.`);
if (failed.length) {
  for (const [name, value] of failed) console.error(`FAIL ${name}: ${String(value)}`);
  process.exit(1);
}
console.log(`Schema verified at ${data?.checkedAt || new Date().toISOString()}`);
