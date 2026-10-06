import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'src/styles/responsive.css',
  'src/App.jsx',
  'src/components/shared/Sidebar.jsx',
  'PHASE12_RESPONSIVE_UX.md',
];
const checks = [
  ['responsive stylesheet imported', /styles\/responsive\.css/.test(fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'))],
  ['mobile nav state', /mobileNavOpen/.test(fs.readFileSync(path.join(root,'src/App.jsx'),'utf8'))],
  ['sidebar drawer class', /td-sidebar-open/.test(fs.readFileSync(path.join(root,'src/components/shared/Sidebar.jsx'),'utf8'))],
  ['mobile overlay', /td-mobile-overlay/.test(fs.readFileSync(path.join(root,'src/styles/responsive.css'),'utf8'))],
  ['responsive table scrolling', /overflow-x:\s*auto/.test(fs.readFileSync(path.join(root,'src/styles/responsive.css'),'utf8'))],
  ['narrow modal handling', /modal-content/.test(fs.readFileSync(path.join(root,'src/styles/responsive.css'),'utf8'))],
  ['reduced motion', /prefers-reduced-motion/.test(fs.readFileSync(path.join(root,'src/styles/responsive.css'),'utf8'))],
];
const missing = required.filter((f) => !fs.existsSync(path.join(root,f)));
if (missing.length) { console.error(`Responsive QA failed: missing ${missing.join(', ')}`); process.exit(1); }
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) { console.error(`Responsive QA failed: ${failed.join(', ')}`); process.exit(1); }
console.log(`Responsive UX QA passed: ${required.length} required files present; ${checks.length} responsive checks passed.`);
