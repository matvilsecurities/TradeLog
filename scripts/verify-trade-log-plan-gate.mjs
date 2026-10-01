import fs from 'node:fs';

const files = {
  tradeLog: 'src/components/trades/TradeLog.jsx',
  app: 'src/App.jsx',
  supabase: 'src/supabase.js',
  css: 'src/styles/tradeLog.css',
};
for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${name}: ${file}`);
}
const tradeLog = fs.readFileSync(files.tradeLog, 'utf8');
const app = fs.readFileSync(files.app, 'utf8');
const supabase = fs.readFileSync(files.supabase, 'utf8');
const css = fs.readFileSync(files.css, 'utf8');
const checks = [
  ['Trade Log fetches today\'s Trading Plan', /fetchTradingPlanByDateDb\(todayIso\)/.test(tradeLog)],
  ['First Trade Log screen presents plan-choice gate', /trade-log-plan-gate/.test(tradeLog)],
  ['Plan checklist is displayed in Trade Log', /trade-log-plan-checklist/.test(tradeLog)],
  ['User can record with today\'s plan', /Record with today's plan/.test(tradeLog)],
  ['User can go without Trading Plan', /Go without trading plan/.test(tradeLog)],
  ['Plan mode is persisted per user/day', /tradelog:trade-log-plan-mode/.test(app)],
  ['New today trades only link after explicit plan choice', /todayTradingPlanMode === "with-plan"/.test(app)],
  ['Without-plan mode leaves relationship empty', /without-plan/.test(app) && /tradePlanLink = \{\}/.test(app)],
  ['Plan checklist is included in trade snapshot', /setupChecklist: activePlan\.setup_checklist/.test(app)],
  ['Supabase Trading Plan fetch includes checklist', /setup_checklist,updated_at/.test(supabase)],
  ['Responsive Trade Log plan styles exist', /trade-log-plan-gate/.test(css) && /@media\(max-width:900px\)/.test(css)],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Trade Log Trading Plan integration QA failed:');
  failed.forEach(([label]) => console.error(`- ${label}`));
  process.exit(1);
}
console.log(`Trade Log Trading Plan integration QA passed: ${checks.length} checks.`);
