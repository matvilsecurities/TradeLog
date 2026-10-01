import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd();
const files=['src/services/securityAudit.js','src/components/apex/SyncCenter.jsx','netlify/_headers','src/hooks/useTradovateConnector.js','src/hooks/useNinjaTraderConnector.js'];
const missing=files.filter(f=>!fs.existsSync(path.join(root,f)));
if(missing.length){console.error(`Security audit QA failed: missing ${missing.join(', ')}`);process.exit(1);}
const source=files.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
const checks=[
 ['secret audit patterns',source.includes('SECRET_IN_CLIENT_ENV')],
 ['server secret warning',source.includes('NT_CLIENT_SECRET')],
 ['read-only connector posture',source.includes('READ_ONLY_CONNECTORS')],
 ['strict transport security',fs.readFileSync(path.join(root,'netlify/_headers'),'utf8').includes('Strict-Transport-Security')],
 ['nosniff',fs.readFileSync(path.join(root,'netlify/_headers'),'utf8').includes('X-Content-Type-Options: nosniff')],
 ['referrer policy',fs.readFileSync(path.join(root,'netlify/_headers'),'utf8').includes('Referrer-Policy')],
 ['OAuth state validation',fs.readFileSync(path.join(root,'src/hooks/useTradovateConnector.js'),'utf8').includes('nonceRef.current')],
 ['OAuth state validation NinjaTrader',fs.readFileSync(path.join(root,'src/hooks/useNinjaTraderConnector.js'),'utf8').includes('nonceRef.current')],
];
const failed=checks.filter(([,ok])=>!ok);if(failed.length){console.error(`Security audit QA failed: ${failed.map(([n])=>n).join(', ')}`);process.exit(1);}console.log(`Security audit QA passed: ${files.length} required files present; ${checks.length} security checks passed.`);
