import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const sidebar=fs.readFileSync(path.join(root,"src/components/shared/Sidebar.jsx"),"utf8");
const app=fs.readFileSync(path.join(root,"src/App.jsx"),"utf8");
const header=fs.readFileSync(path.join(root,"src/components/dashboard/DashboardHeader.jsx"),"utf8");
const dashboard=fs.readFileSync(path.join(root,"src/components/dashboard/TradeJournalDashboard.jsx"),"utf8");
const css=fs.readFileSync(path.join(root,"src/styles/professional-ui.css"),"utf8");
const checks=[
["Sidebar account selector removed",!sidebar.includes("td-account-switcher")&&!sidebar.includes("Active trading account")],
["Dashboard account selector component",header.includes("td-account-select")],
["Dashboard account dropdown",header.includes("td-account-dropdown")],
["Account selection callback",header.includes("onSelectAccount?.(account.id)")],
["Account context passed to dashboard",dashboard.includes("accounts={accounts}")&&dashboard.includes("activeAccount={activeAccount}")],
["App passes dashboard account selector callback",app.includes("onSelectAccount={handleDashboardAccountSelect}")],
["Dashboard selector styling",css.includes(".td-account-select")&&css.includes(".td-account-dropdown")],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){failed.forEach(([name])=>console.error(`FAIL: ${name}`));process.exit(1);}
console.log(`Account selector QA passed: ${checks.length} checks passed.`);
