import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/hooks/useAccountPortfolio.js',
  'src/components/apex/PortfolioCenter.jsx',
  'src/components/shared/Sidebar.jsx',
  'src/components/dashboard/DashboardHeader.jsx',
  'src/components/dashboard/TradeJournalDashboard.jsx',
  'src/App.jsx',
];
const text = Object.fromEntries(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const checks = [
  ['portfolio hook exists', fs.existsSync(path.join(root, 'src/hooks/useAccountPortfolio.js'))],
  ['portfolio center exists', fs.existsSync(path.join(root, 'src/components/apex/PortfolioCenter.jsx'))],
  ['dashboard account selector is wired', text['src/components/dashboard/DashboardHeader.jsx'].includes('onSelectAccount?.(account.id)')],
  ['multi-account route wired', text['src/App.jsx'].includes('view === "portfolio"')],
  ['active trades are account-filtered', text['src/App.jsx'].includes('filterTradesForAccount(trades, activeAccount)')],
  ['new trades carry accountId', text['src/App.jsx'].includes('accountId: activeAccountId')],
  ['account settings are scoped', text['src/App.jsx'].includes('activeAccountSettings')],
  ['database is authoritative', text['src/hooks/useAccountPortfolio.js'].includes('fetchAccountsDb') && text['src/hooks/useAccountPortfolio.js'].includes('saveAccountDb')],
  ['new account is persisted immediately', text['src/hooks/useAccountPortfolio.js'].includes('persistAccount(account)')],
  ['active account selection is cached', text['src/hooks/useAccountPortfolio.js'].includes('writeJson(activeKey, id)')],
  ['portfolio has database hydration', text['src/hooks/useAccountPortfolio.js'].includes('fetchAccountsDb')],
  ['account refresh action exists', text['src/hooks/useAccountPortfolio.js'].includes('refreshAccounts') && text['src/App.jsx'].includes('refreshAccounts()')],
  ['account hydration retries transient failure', text['src/hooks/useAccountPortfolio.js'].includes('retry once')],
  ['legacy primary ID preserved', text['src/hooks/useAccountPortfolio.js'].includes('id: "primary"')],
  ['prop-firm compliance is calculated per account', text['src/components/apex/PortfolioCenter.jsx'].includes('calculatePropFirmCompliance(accountTrades, account.settings)')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) throw new Error(`Multi-account QA failed: ${failed.map(([name]) => name).join(', ')}`);
console.log(`Multi-account QA passed: ${checks.length} checks passed.`);
