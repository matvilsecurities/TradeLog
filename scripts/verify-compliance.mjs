import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const required = ['src/services/propFirmCompliance.js','src/hooks/usePropFirmCompliance.js','src/components/apex/ComplianceCenter.jsx','src/components/apex/AccountCenter.jsx','src/Services/NOPE'];
const actualRequired = required.filter((f) => f !== 'src/Services/NOPE');
for (const file of actualRequired) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing required file: ${file}`);
const engine = read('src/services/propFirmCompliance.js');
const center = read('src/components/apex/ComplianceCenter.jsx');
const account = read('src/components/apex/AccountCenter.jsx');
const risk = read('src/components/analytics/RiskManager.jsx');
const modal = read('src/components/trades/TradeModal.jsx');
const app = read('src/App.jsx');
const checks = [
  ['Normalized rule snapshot', engine.includes('normalizePropRules')],
  ['Daily loss guard', engine.includes('dailyLossExceeded')],
  ['Drawdown guard', engine.includes('drawdownExceeded')],
  ['Instrument-aware position guard', engine.includes('calculatePositionCompliance') && engine.includes('maxMicrosExceeded')],
  ['Consistency tracking', engine.includes('consistencyExceeded')],
  ['Compliance center route', app.includes('view === "compliance"')],
  ['Trade-entry enforcement', modal.includes('complianceBlocked')],
  ['Account center integration', account.includes('usePropFirmCompliance')],
  ['Risk manager integration', risk.includes('usePropFirmCompliance')],
  ['Rule source attribution', center.includes('Rules source') && engine.includes('propRulesSource')],
];
const failed = checks.filter(([,ok])=>!ok);
if (failed.length) throw new Error(failed.map(([n])=>`Check failed: ${n}`).join('\n'));
console.log(`Compliance QA passed: ${actualRequired.length} required files present; ${checks.length} checks passed.`);
