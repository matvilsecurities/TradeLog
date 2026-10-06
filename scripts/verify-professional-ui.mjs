import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/styles/professional-ui.css',
  'src/components/shared/Sidebar.jsx',
  'src/App.jsx',
  'src/assets/matvil-logo.png',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}

const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'src/components/shared/Sidebar.jsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/professional-ui.css'), 'utf8');
const dashboardHeader = fs.readFileSync(path.join(root, 'src/components/dashboard/DashboardHeader.jsx'), 'utf8');

const checks = [
  ['professional UI stylesheet imported', app.includes('./styles/professional-ui.css')],
  ['main shell class applied', app.includes('className="tl-main-shell"')],
  ['route-level lazy loading enabled', (app.match(/const \w+ = lazy\(\(\) => import\(/g) || []).length >= 15],
  ['route Suspense boundary present', app.includes('<Suspense fallback={<PageLoading compact />}>')],
  ['trade modal lazy loaded', app.includes('lazy(() => import("./components/trades/TradeModal"))')],
  ['logo uses matvil-logo.png', sidebar.includes('../../assets/matvil-logo.png')],
  ['dashboard account selector has accessible label', dashboardHeader.includes('aria-label="Select trading account"')],
  ['professional design tokens present', css.includes('--tl-surface') && css.includes('--tl-accent')],
  ['keyboard focus styling present', css.includes(':focus-visible') && css.includes('--tl-focus')],
  ['reduced motion support present', css.includes('prefers-reduced-motion')],
  ['responsive sidebar sizing present', css.includes('@media (max-width: 1200px)')],
  ['no forced full page reload remains', !app.includes('window.location.reload(')],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}
console.log(`Professional UI QA passed: ${required.length} required files present; ${checks.length} polish checks passed.`);
