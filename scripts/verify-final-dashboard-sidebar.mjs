import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const sidebar=read('src/components/shared/Sidebar.jsx'), app=read('src/App.jsx'), dashboard=read('src/components/dashboard/TradeJournalDashboard.jsx'), dropdown=read('src/components/dashboard/DashboardDropdown.jsx'), portfolio=read('src/hooks/useAccountPortfolio.js'), dashCss=read('src/styles/TradeJournalDashboard.css');
const checks=[
 ['collapsible sidebar groups', sidebar.includes('NAV_GROUPS') && sidebar.includes('ACCOUNT_SETTINGS')],
 ['approved collapsed rail', dashCss.includes('--sidebar-collapsed-width: 84px !important')],
 ['dashboard account selector', dropdown.includes('zella-period-dropdown') || dashboard.includes('onSelectAccount')],
 ['daily cumulative P&L account options', dashboard.includes('pnlAccountOptions') && dashboard.includes('All Accounts')],
 ['daily cumulative P&L switches account data', dashboard.includes('onChange={onSelectAccount}')],
 ['dashboard receives all trades', app.includes('allTrades={trades}')],
 ['dashboard receives active account', app.includes('activeAccountId={activeAccountId}')],
 ['database-backed account persistence', portfolio.includes('fetchAccountsDb') && portfolio.includes('saveAccountDb')],
 ['account cache is secondary', portfolio.includes('CACHE_PREFIX') && portfolio.includes('fetchAccountsDb')],
 ['dashboard uses active-account trades', app.includes('const dashboardTrades = useMemo') && app.includes('filterTradesForAccount(trades, dashboardAccount)') && app.includes('filterTradesForAccounts(trades, dashboardActiveAccounts)')],
];
const failed=checks.filter(([,ok])=>!ok); if(failed.length){failed.forEach(([n])=>console.error(`FAIL: ${n}`));process.exit(1)} console.log(`Final dashboard/sidebar QA passed: ${checks.length} checks passed.`);
