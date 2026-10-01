import fs from 'node:fs';
const jsx=fs.readFileSync('src/components/apex/PropFirmSetup.jsx','utf8');
const css=fs.readFileSync('src/styles/prop-firm-setup.css','utf8');
const checks=[
  ['account stage state', jsx.includes('accountStage')],
  ['funded account name field', jsx.includes('fundedAccountName')],
  ['funded account number field', jsx.includes('fundedAccountNumber')],
  ['separate funded creation', jsx.includes('createFundedAccountFromEvaluation') && jsx.includes('onCreateAccount(fundedSettings')],
  ['evaluation link', jsx.includes('fundedFromEvaluationId')],
  ['funded notification', jsx.includes('funded-account-created')],
  ['evaluation/funded portfolio counts', jsx.includes('fundedCount') && jsx.includes('evaluationCount')],
  ['funded UI styles', css.includes('.pf-funded-fields') && css.includes('.pf-create-funded')],
  ['funded action in account cards', jsx.includes('Create Funded Account')],
];
let failed=0; for(const [name,ok] of checks){ console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
if(failed) process.exit(1);
console.log(`Funded account workflow QA passed: ${checks.length}/${checks.length}`);
