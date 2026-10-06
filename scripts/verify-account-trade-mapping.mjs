import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'src/components/trades/TradeLog.jsx'), 'utf8');
const supabase = fs.readFileSync(path.join(root, 'src/supabase.js'), 'utf8');
const portfolio = fs.readFileSync(path.join(root, 'src/hooks/useAccountPortfolio.js'), 'utf8');

const checks = [
  ['main Ledger receives all active-account trades', app.includes('TradeLog trades={filterTradesForAccounts(trades, dashboardActiveAccounts)}')],
  ['Ledger resolves selected account from the account list', ledger.includes('const selectedAccount = accounts.find((account) => String(account.id) === String(accountId)) || null;')],
  ['Ledger matches canonical account UUID', ledger.includes('tradeAccountUuid !== selectedAccountUuid')],
  ['Ledger matches legacy/application account ID', ledger.includes('tradeAccountId !== selectedAccountId')],
  ['account mapping defines accounts.id as canonical UUID', portfolio.includes('canonical UUID primary key used by trades.account_uuid')],
  ['manual save does not infer live capture from empty executionIds', supabase.includes('trade.executionIds.length > 0')],
  ['live capture metadata remains supported when actually present', supabase.includes('hasLiveCaptureMetadata') && supabase.includes('dbPayload.capture_status')],
  ['capture metadata is not sent merely because executionIds is an empty array', !supabase.includes('if (trade.captureStatus || Array.isArray(trade.executionIds) || trade.liveTradeKey)')],
  ['Prop Firm Setup resolves trades with the full account object (legacy id + canonical UUID)', fs.readFileSync(path.join(root, 'src/components/apex/PropFirmSetup.jsx'), 'utf8').includes('filterTradesForAccount(trades, account);')],
  ['Portfolio Center resolves trades with the full account object (legacy id + canonical UUID)', fs.readFileSync(path.join(root, 'src/components/apex/PortfolioCenter.jsx'), 'utf8').includes('filterTradesForAccount(trades, account);')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL: ${name}`));
  process.exit(1);
}
console.log(`Account/trade mapping QA passed: ${checks.length} checks passed.`);
