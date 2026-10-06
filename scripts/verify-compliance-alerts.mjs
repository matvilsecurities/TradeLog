import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const required=['src/services/propFirmAlerts.js','src/hooks/useComplianceAlerts.js','src/components/apex/ComplianceAlerts.jsx','src/App.jsx','src/components/shared/Sidebar.jsx','package.json'];
for(const f of required) if(!fs.existsSync(path.join(root,f))) throw new Error(`Missing required file: ${f}`);
const alert=read('src/services/propFirmAlerts.js'), hook=read('src/hooks/useComplianceAlerts.js'), side=read('src/components/shared/Sidebar.jsx'), app=read('src/App.jsx');
const checks=[
 ['alert engine',/buildComplianceAlerts/.test(alert)],['threshold monitoring',/75|90|100/.test(alert)],['daily loss alerts',/daily-loss/.test(alert)],['drawdown alerts',/drawdown/.test(alert)],['consistency alerts',/consistency/.test(alert)],['profit target alerts',/profit-target/.test(alert)],['persistent alert history',/localStorage/.test(hook)],['browser notifications',/Notification/.test(hook)],['sidebar alerts entry',/\["alerts",\s*Bell/.test(side)],['global monitoring hook',/useComplianceAlerts\(compliance/.test(app)]];
const failed=checks.filter(([,ok])=>!ok); if(failed.length) throw new Error(failed.map(([n])=>`Check failed: ${n}`).join('\n'));
console.log(`Compliance alerts QA passed: ${required.length} required files present; ${checks.length} checks passed.`);
