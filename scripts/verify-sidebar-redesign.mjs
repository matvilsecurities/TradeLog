import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const sidebar = fs.readFileSync(path.join(root, 'src/components/shared/Sidebar.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/professional-ui.css'), 'utf8');
const dashboardCss = fs.readFileSync(path.join(root, 'src/styles/TradeJournalDashboard.css'), 'utf8');
const header = fs.readFileSync(path.join(root, 'src/components/dashboard/DashboardHeader.jsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/components/dashboard/TradeJournalDashboard.jsx'), 'utf8');
const checks = [
  ['sidebar collapse state persisted', sidebar.includes('tradelog:sidebar-collapsed')],
  ['collapse/expand control present', sidebar.includes('td-sidebar-collapse') && sidebar.includes('setCollapsed')],
  ['collapsed rail class present', sidebar.includes('td-sidebar-collapsed')],
  ['workspace navigation is grouped', sidebar.includes('WORKSPACE_ITEMS')],
  ['analysis navigation is grouped', sidebar.includes('NAV_GROUPS')],
  ['account settings navigation is grouped', sidebar.includes('ACCOUNT_SETTINGS')],
  ['profile navigation remains supported', sidebar.includes('profileOpen')],
  ['dashboard account selector present', header.includes('td-account-select') && header.includes('onSelectAccount')],
  ['dashboard receives account context', dashboard.includes('accounts={accounts}') && dashboard.includes('activeAccount={activeAccount}')],
  ['packed flex navigation prevents empty stretch', css.includes('flex-direction:column!important') && css.includes('justify-content:flex-start!important')],
  ['independent sidebar scrolling present', css.includes('overflow-y:auto!important')],
  ['light theme sidebar surface present', css.includes('.app-theme-light .td-sidebar')],
  ['dark theme sidebar surface present', css.includes('.app-theme-dark .td-sidebar')],
  ['ambient hover treatment present', dashboardCss.includes('radial-gradient(circle at 50% 50%, rgba(118,87,255,.15)')],
  ['approved collapsed width present', dashboardCss.includes('--sidebar-collapsed-width: 84px !important')],
  ['reduced motion support present', css.includes('@media (prefers-reduced-motion:reduce)')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  failed.forEach(([name]) => console.error(`FAIL: ${name}`));
  process.exit(1);
}
console.log(`Sidebar redesign QA passed: ${checks.length} checks passed.`);
