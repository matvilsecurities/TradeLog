import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sidebar = fs.readFileSync(path.join(root, 'src/components/shared/Sidebar.jsx'), 'utf8');
const header = fs.readFileSync(path.join(root, 'src/components/dashboard/DashboardHeader.jsx'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/components/dashboard/TradeJournalDashboard.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/professional-ui.css'), 'utf8');

const checks = [
  ['Account Center remains in Account group', /label: "Account"[\s\S]*?\[\["account"/.test(sidebar)],
  ['Guided Entry action remains available', /setShowGuidedModal/.test(fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8'))],
  ['Sidebar theme footer removed', !/td-sidebar-theme-toggle/.test(sidebar)],
  ['Profile navigation exists', /td-profile-trigger/.test(sidebar) && /Profile/.test(sidebar)],
  ['Profile Appearance toggles theme', /td-profile-menu[\s\S]*?toggleTheme/.test(sidebar)],
  ['Profile Navigation control exists', /Toggle sidebar density/.test(sidebar)],
  ['Dashboard theme icon exists', /td-theme-icon-button/.test(header)],
  ['Dashboard receives theme toggle', /toggleTheme=\{toggleTheme\}/.test(dashboard)],
  ['Profile CSS exists', /\.td-profile-trigger/.test(css) && /\.td-profile-menu/.test(css)],
  ['Dashboard theme icon CSS exists', /\.td-theme-icon-button/.test(css)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Profile navigation QA failed: ${failed.length} checks failed.`);
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log(`Profile navigation QA passed: ${checks.length} checks passed.`);
