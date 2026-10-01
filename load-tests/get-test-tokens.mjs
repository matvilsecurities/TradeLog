import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const count = Number.parseInt(process.env.TRADELOG_TEST_USER_COUNT || "10", 10);
const prefix = process.env.TRADELOG_TEST_EMAIL_PREFIX || "tradelog-loadtest";
const domain = process.env.TRADELOG_TEST_EMAIL_DOMAIN || "example.invalid";
const password = process.env.TRADELOG_TEST_PASSWORD;
const output = process.env.TRADELOG_TEST_TOKENS_FILE || "load-tests/test-tokens.json";

if (!url || !anonKey || !password) {
  throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY, and TRADELOG_TEST_PASSWORD.");
}

const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const tokens = [];
const failures = [];

for (let i = 1; i <= count; i += 1) {
  const email = `${prefix}-${String(i).padStart(4, "0")}@${domain}`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session?.access_token) {
    failures.push({ email, message: error?.message || "No access token returned" });
    continue;
  }

  tokens.push(data.session.access_token);
}

await writeFile(output, JSON.stringify(tokens, null, 2), { encoding: "utf8" });

console.log(`Tokens written: ${tokens.length}`);
console.log(`Failures: ${failures.length}`);
console.log(`File: ${output}`);

if (failures.length) {
  for (const item of failures) console.log(`${item.email}\t${item.message}`);
  process.exitCode = 2;
}
