import fs from "node:fs";

const files = [
  "src/components/analytics/TradeReview.jsx",
  "src/supabase.js",
  "supabase/migrations/20260929_trade_review_workspace.sql",
];
for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}
const review = fs.readFileSync(files[0], "utf8");
const supabase = fs.readFileSync(files[1], "utf8");
const migration = fs.readFileSync(files[2], "utf8");
const checks = [
  ["losses prioritized", /Losses automatically|Losses stay prioritized|outcomeOf\(trade\) === \"Loss\"/.test(review)],
  ["review filters", /reviewFilter/.test(review)],
  ["notes editor", /noteDraft|Review notes/.test(review)],
  ["save review action", /saveTradeReviewDb/.test(review)],
  ["Supabase review fetch", /fetchTradeReviewsDb/.test(supabase)],
  ["Supabase review upsert", /saveTradeReviewDb/.test(supabase)],
  ["review table", /create table if not exists public\.trade_reviews/.test(migration)],
  ["review RLS", /trade_reviews_select_own|trade_reviews_insert_own_trade|trade_reviews_update_own/.test(migration)],
  ["schema gate", /table:trade_reviews|rls:trade_reviews/.test(migration)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL ${name}`);
  process.exit(1);
}
console.log(`Trade review QA passed: ${checks.length}/${checks.length} checks passed.`);
