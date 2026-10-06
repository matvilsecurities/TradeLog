import fs from 'node:fs';

const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const ledger = fs.readFileSync(new URL('../src/components/trades/TradeLog.jsx', import.meta.url), 'utf8');

const checks = [
  ['Trade entry context state exists', app.includes('tradeEntryAccountId'), 'Missing tradeEntryAccountId state'],
  ['Add Trade accepts requested account', app.includes('openAdd = useCallback((requestedAccountId = null)'), 'openAdd does not accept an explicit account'],
  ['Ledger passes selected account', ledger.includes('onAdd?.(accountId === "all" ? null : accountId)'), 'Ledger Add Trade does not pass its selected account'],
  ['New trade resolves explicit entry account first', app.includes('const explicitTradeAccount = resolveAccountReference(rawTradeAccountRef);') && app.includes('const entryAccount = resolveAccountReference(tradeEntryAccountId);') && app.includes('explicitTradeAccount || entryAccount || dashboardTarget || activeTarget'), 'Save path does not prioritize explicit entry account'],
  ['New trade persists canonical account UUID', app.includes('accountUuid: String(persistedTradeAccount.accountUuid || persistedTradeAccount.uuid || "")'), 'Save path does not resolve account UUID'],
  ['Compliance uses target account', app.includes('filterTradesForAccount(trades, savedAccount)') && app.includes('calculatePropFirmCompliance(candidateTrades, accountSettings)'), 'Post-save compliance still scopes to unrelated active account'],
  ['Existing trade keeps its own account', app.includes('resolveAccountReference(trade?.accountId ?? trade?.account_id ?? trade?.accountUuid ?? trade?.account_uuid)'), 'Edit path does not preserve persisted account'],
];

let failed = 0;
for (const [name, ok, message] of checks) {
  if (!ok) { failed += 1; console.error(`FAIL: ${name} — ${message}`); }
  else console.log(`PASS: ${name}`);
}
if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} trade-entry account-context checks passed.`);
