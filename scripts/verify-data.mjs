import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'src/components/data/DataCenter.jsx',
  'src/components/shared/Sidebar.jsx',
  'src/App.jsx',
  'package.json',
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required file: ${file}`);
}
const data = fs.readFileSync(path.join(root, 'src/components/data/DataCenter.jsx'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const side = fs.readFileSync(path.join(root, 'src/components/shared/Sidebar.jsx'), 'utf8');
const checks = [
  ['JSON backup export', /Export full JSON backup/.test(data) && /accounts,/.test(data)],
  ['trade CSV export', /Export trades CSV/.test(data)],
  ['missed trade CSV export', /Export missed trades CSV/.test(data)],
  ['non-destructive data center', /does not modify Supabase/.test(data)],
  ['data view wired', /view === "data"/.test(app)],
  ['sidebar entry wired', /\[\"data\",\s*Database/.test(side)],
  ['verification script registered', /verify:data/.test(fs.readFileSync(path.join(root,'package.json'),'utf8'))],
];
for (const [name, ok] of checks) if (!ok) throw new Error(`Check failed: ${name}`);
console.log(`Data center QA passed: ${required.length} required files present; ${checks.length} data checks passed.`);
