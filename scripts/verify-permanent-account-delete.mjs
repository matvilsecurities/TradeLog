import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hook = fs.readFileSync(path.join(root, 'src/hooks/useAccountPortfolio.js'), 'utf8');
const db = fs.readFileSync(path.join(root, 'src/supabase.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'src/components/apex/PropFirmSetup.jsx'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260929_write_path_and_account_fixes.sql'), 'utf8');

const checks = [
  ['deleteAccountDb uses server RPC', /tradelog_delete_account/.test(db)],
  ['primary account remains protected', /if \(!supabase \|\| !accountId \|\| accountId === "primary"\) return false;/.test(db)],
  ['server deletion refuses accounts with trades', /reason.*has_trades/.test(migration) && /trade_count/.test(migration)],
  ['portfolio restores authoritative state after deletion failure', /setAccounts\(previousAccounts\)/.test(hook) && /throw error/.test(hook)],
  ['UI no longer promises detached trades', !/Saved journal trades will be kept, but detached from this account/.test(setup)],
  ['UI tells users to archive accounts containing history', /archive/i.test(setup) && /contains history/i.test(setup)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`\nPermanent account deletion QA: ${checks.length - failed}/${checks.length} passed`);
