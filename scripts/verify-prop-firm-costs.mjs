import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const component = fs.readFileSync(path.join(root, 'src/components/apex/PropFirmSetup.jsx'), 'utf8');
const portfolio = fs.readFileSync(path.join(root, 'src/hooks/useAccountPortfolio.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/prop-firm-setup.css'), 'utf8');

const checks = [
  ['Cost editor state exists', /costEditAccountId/.test(component)],
  ['Purchase price editor exists', /costPurchasePrice/.test(component)],
  ['Activation fee editor exists', /costActivationFee/.test(component)],
  ['Existing account cost editor action exists', /className="pf-edit-costs"/.test(component)],
  ['Cost editor persists purchasePrice', /purchasePrice:\s*purchase/.test(component)],
  ['Cost editor persists accountPurchasePrice', /accountPurchasePrice:\s*purchase/.test(component)],
  ['Cost editor persists activationFeePaid', /activationFeePaid:\s*activation/.test(component)],
  ['Cost editor persists accountActivationFeePaid', /accountActivationFeePaid:\s*activation/.test(component)],
  ['Portfolio totals use purchasePaid', /totalPurchasePaid[\s\S]*purchasePaid/.test(component)],
  ['Portfolio totals use activationPaid', /totalActivationPaid[\s\S]*activationPaid/.test(component)],
  ['Account update persistence exists', /persistAccount\(nextAccount\)/.test(portfolio)],
  ['Cost editor styles exist', /\.pf-cost-modal/.test(css)],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Prop-firm cost QA passed: ${checks.length} checks passed.`);
