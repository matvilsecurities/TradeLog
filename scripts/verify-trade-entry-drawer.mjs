import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const modal = fs.readFileSync(path.join(root, 'src/components/trades/TradeModal.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/professional-ui.css'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/components/dashboard/TradeJournalDashboard.jsx'), 'utf8');

const checks = [
  ['TradeModal is used for Log Trade', /TradeModal/.test(app)],
  ['Trade entry uses drawer markup', /td-trade-drawer/.test(modal)],
  ['Drawer is left-anchored', /td-trade-drawer-overlay\s*\{[\s\S]*left:\s*var\(--td-trade-drawer-left/.test(css)],
  ['Drawer has compact max width', /max-width:\s*390px/.test(css)],
  ['Drawer uses single-column sections', (modal.match(/td-trade-drawer-section/g) || []).length >= 3],
  ['Dashboard has no Trading Discipline reference', !/Trading Discipline|TradingDiscipline|td-discipline/.test(dashboard)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Trade entry drawer QA failed:');
  failed.forEach(([name]) => console.error(`- ${name}`));
  process.exit(1);
}
console.log(`Trade entry drawer QA passed: ${checks.length} checks passed.`);
