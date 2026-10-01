import fs from 'node:fs';

const jsx = fs.readFileSync(new URL('../src/components/shared/Sidebar.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/styles/professional-ui.css', import.meta.url), 'utf8');

const checks = [
  ['Workspace toggle handler', /setWorkspaceOpen\(\(open\) => !open\)/.test(jsx)],
  ['Analysis toggle handler', /setOpen\(\(value\) => !value\)/.test(jsx)],
  ['Account toggle handler', /setOpen\(\(value\) => !value\)/.test(jsx)],
  ['Tools toggle handler', /setOpen\(\(value\) => !value\)/.test(jsx)],
  ['Account Settings toggle handler', /setAccountSettingsOpen\(v => !v\)/.test(jsx)],
  ['Profile toggle handler', /setProfileOpen\(\(open\) => !open\)/.test(jsx)],
  ['Open menus accept pointer events', /\.td-sidebar \.td-workspace-menu\.is-open[\s\S]*?pointer-events: auto !important/.test(css)],
  ['Closed menus block pointer events', /\.td-sidebar \.td-workspace-menu,[\s\S]*?pointer-events: none !important/.test(css)],
  ['Expanded sidebar is 210px', /--sidebar-width: 210px !important[\s\S]*?width: 210px !important/.test(css)],
  ['Collapsed rail remains 68px', /--sidebar-collapsed-width:68px/.test(css)],
];
let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`PASS: ${checks.length}/${checks.length} sidebar interaction checks`);
