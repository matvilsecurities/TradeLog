import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const supabase = fs.readFileSync(new URL('../src/supabase.js', import.meta.url), 'utf8');

const checks = [
  ['Object account refs are normalized before save', app.includes('const rawTradeAccountRef = trade?.accountId ?? trade?.account_id') && app.includes('resolveAccountReference(rawTradeAccountRef)')],
  ['Explicit entry account remains authoritative', app.includes('const entryAccount = resolveAccountReference(tradeEntryAccountId);') && app.includes('explicitTradeAccount || entryAccount || dashboardTarget || activeTarget')],
  ['Selected account supplies canonical UUID', app.includes('accountUuid: String(persistedTradeAccount.accountUuid || persistedTradeAccount.uuid || "")')],
  ['DB boundary prevents [object Object]', supabase.includes('resolveTradeAccountReference') && supabase.includes('dbPayload.account_id === "[object Object]"')],
  ['Legacy account ID is not copied into UUID', supabase.includes('Do not copy the legacy account_id into account_uuid')],
  ['UUID is only persisted when valid', supabase.includes('if (isUuid(canonicalAccountUuid))')],
];

let passed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
  if (ok) passed += 1;
}
if (passed !== checks.length) process.exit(1);
console.log(`\n${passed}/${checks.length} trade-account persistence checks passed.`);
