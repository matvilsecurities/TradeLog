import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const count = Number.parseInt(process.env.TRADELOG_TEST_USER_COUNT || "10", 10);
const prefix = process.env.TRADELOG_TEST_EMAIL_PREFIX || "tradelog-loadtest";
const domain = process.env.TRADELOG_TEST_EMAIL_DOMAIN || "example.invalid";
const password = process.env.TRADELOG_TEST_PASSWORD;

if (!url || !secretKey || !password) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY), and TRADELOG_TEST_PASSWORD."
  );
}
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  throw new Error("TRADELOG_TEST_USER_COUNT must be an integer from 1 to 1000.");
}

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const created = [];
const failed = [];

for (let i = 1; i <= count; i += 1) {
  const email = `${prefix}-${String(i).padStart(4, "0")}@${domain}`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { load_test: true, load_test_index: i },
  });

  if (error) {
    failed.push({ email, message: error.message });
    continue;
  }

  created.push({ email, user_id: data.user?.id });
}

console.log(`Created: ${created.length}`);
console.log(`Failed: ${failed.length}`);

if (created.length) {
  console.log("Created users:");
  for (const user of created) console.log(`${user.email}\t${user.user_id}`);
}

if (failed.length) {
  console.log("Failures:");
  for (const item of failed) console.log(`${item.email}\t${item.message}`);
}

if (failed.length) process.exitCode = 2;
