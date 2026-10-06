import fs from 'node:fs';

const compliance = fs.readFileSync('src/services/propFirmCompliance.js', 'utf8');
const guided = fs.readFileSync('src/components/trades/GuidedEntryModal.jsx', 'utf8');
const app = fs.readFileSync('src/App.jsx', 'utf8');
const setup = fs.readFileSync('src/components/apex/PropFirmSetup.jsx', 'utf8');
const css = fs.readFileSync('src/styles/prop-firm-setup.css', 'utf8');
const constants = fs.readFileSync('src/constants.js', 'utf8');

const checks = [
  ['intraday drawdown detection', /type\.includes\("intraday"\).*type\.includes\("trail"\)/s.test(compliance)],
  ['peak price metadata', /__intraday_trailing/.test(guided) && /peakPrice/.test(guided)],
  ['long/short favorable excursion', /direction === "short" \? Math\.max\(0, entry - peak\)/.test(compliance)],
  ['maximum equity HWM', /const intradayPeak = equity \+ peakPnlForTrade/.test(compliance) && /highWaterMark = intradayPeak/.test(compliance)],
  ['trailing threshold output', /trailingThreshold/.test(compliance)],
  ['Guided Entry receives active settings', /GuidedEntryModal[^\n]*settings=\{\(accounts\.find\(\(account\) => String\(account\.id\) === String\(tradeEntryAccountId\)\) \|\| \(dashboardAccountId !== \"all\" \? dashboardAccount : activeAccount\)\)\?\.settings \|\| activeAccountSettings\}/.test(app)],
  ['intraday UI is conditional', /\{isIntradayTrailing && \(/.test(guided)],
  ['peak threshold lift shown', /Trailing threshold lift/.test(guided)],
  ['account stage no overlap class', /pf-account-stage/.test(setup) && /grid-area:stage/.test(css)],
  ['metadata excluded from setup grade', /typeof value === "boolean" && value/.test(constants)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Intraday trailing QA: ${checks.length}/${checks.length} passed`);
