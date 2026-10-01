import { existsSync, readFileSync } from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const files=['src/hooks/useTradeIntelligence.js','src/hooks/usePerformanceStats.js','src/components/analytics/TradeIntelligence.jsx','src/components/analytics/Analytics.jsx','src/components/shared/Sidebar.jsx','src/App.jsx'];
for(const f of files) if(!existsSync(path.join(root,f))) throw new Error(`Missing required intelligence file: ${f}`);
const read=f=>readFileSync(path.join(root,f),'utf8'); const hook=read(files[0]), view=read(files[2]), app=read(files[5]), side=read(files[4]);
const checks=[hook.includes('expectancyPerTrade'),hook.includes('edgeMatrix'),hook.includes('checklistImpact'),hook.includes('mistakeImpact'),view.includes('Trade Intelligence'),view.includes('Actionable Signals'),view.includes('Setup × Session Edge Map'),view.includes('Behavior & Risk'),app.includes('TradeIntelligence'),/\["intelligence",\s*Sparkles/.test(side)];
if(checks.some(v=>!v)) throw new Error('Intelligence QA failed: one or more current intelligence contracts are missing');
console.log(`Trade intelligence QA passed: ${files.length} required files present; ${checks.length} checks passed.`);
