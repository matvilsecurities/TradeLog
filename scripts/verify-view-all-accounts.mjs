import fs from 'node:fs';

const file = 'src/components/apex/PropFirmSetup.jsx';
const src = fs.readFileSync(file, 'utf8');
const failures = [];

if (!src.includes('import { createPortal } from "react-dom";')) failures.push('createPortal import missing');
if (!src.includes('const allAccountsPortal = showAllAccounts ? createPortal(')) failures.push('All Accounts portal is not hoisted outside conditional rendering');
if (!src.includes('{allAccountsPortal}')) failures.push('All Accounts portal is not rendered at root level');
if (src.includes('{showAllAccounts && createPortal(')) failures.push('Old conditional portal remains inside setup-form branch');
if (!src.includes('className="pf-view-all-accounts" onClick={openAllAccounts}')) failures.push('View All Accounts button handler missing');
if (!src.includes('const openAllAccounts = () => {')) failures.push('openAllAccounts handler missing');

// Verify the root-level portal is after the showSetupForm/program ternary closes.
const portalDecl = src.indexOf('const allAccountsPortal =');
const returnIndex = src.indexOf('return (', portalDecl);
const rootRender = src.indexOf('{allAccountsPortal}', returnIndex);
const ternaryClose = src.lastIndexOf('        )}', rootRender);
if (!(portalDecl > 0 && returnIndex > portalDecl && rootRender > returnIndex && ternaryClose < rootRender)) {
  failures.push('All Accounts portal is not structurally outside the main showSetupForm ternary');
}

if (failures.length) {
  console.error('VIEW_ALL_ACCOUNTS_FAIL');
  failures.forEach((x) => console.error(`- ${x}`));
  process.exit(1);
}
console.log('VIEW_ALL_ACCOUNTS_PASS');
console.log('✓ View All Accounts portal is mounted independently of the setup-form conditional.');
console.log('✓ The portfolio button calls openAllAccounts.');
console.log('✓ The previous unmounted-portal pattern is absent.');
