import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = [
  'src/services/propFirmRules.js',
  'src/hooks/usePropFirmRules.js',
  'src/components/apex/PropFirmSetup.jsx',
  'netlify/functions/prop-rules.js',
  'src/App.jsx',
  'src/components/shared/Sidebar.jsx',
];
for (const file of required) if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
const service = fs.readFileSync(path.join(root, 'src/services/propFirmRules.js'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'src/components/apex/PropFirmSetup.jsx'), 'utf8');
const fn = fs.readFileSync(path.join(root, 'netlify/functions/prop-rules.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const sidebar = fs.readFileSync(path.join(root, 'src/components/shared/Sidebar.jsx'), 'utf8');
const checks = [
  ['Apex catalog', service.includes('Apex Trader Funding')],
  ['Apex 25K Intraday Trail', service.includes('APEX_NEW_SIZES') && service.includes('Intraday Trail') && service.includes('25: { intraday')],
  ['Apex futures vendor map', service.includes('Tradovate') && service.includes('Rithmic') && service.includes('WealthCharts')],
  ['Apex no activation variant', service.includes('APEX_NO_ACTIVATION_PRICES') && service.includes('No Activation Fee')],
  ['Topstep catalog', service.includes('Topstep')],
  ['FundedNext catalog', service.includes('FundedNext Futures')],
  ['FTMO catalog', service.includes('FTMO')],
  ['The5ers catalog', service.includes('The5ers')],
  ['Tradeify catalog', service.includes('Tradeify')],
  ['Firm name excludes market category', service.includes('markets: ["Futures"]') && service.includes('markets: ["CFD"]')],
  ['Apex account variants', service.includes('New Accounts') && service.includes('Legacy Accounts')],
  ['The5ers Black Arrow restriction', service.includes('vendorOptions: { Futures: ["Black Arrow"]')],
  ['CFD vendor catalog', service.includes('cTrader') && service.includes('MetaTrader 5') && service.includes('MetaTrader 4')],
  ['Program dropdown', setup.includes(' · PROGRAM') && setup.includes('Select program…')],
  ['Apply rules', setup.includes('Apply Rules & Start Journal')],
  ['Serverless fetch', fn.includes('fetch(url')],
  ['Prop firm route', app.includes('view === "propfirm"') && sidebar.includes('Prop Firm Setup')],
];
for (const [label, ok] of checks) if (!ok) throw new Error(`Check failed: ${label}`);
console.log(`Prop firm rules QA passed: ${required.length} required files present; ${checks.length} rules checks passed.`);
