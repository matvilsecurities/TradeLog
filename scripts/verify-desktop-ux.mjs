import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/App.jsx",
  "src/components/shared/Sidebar.jsx",
  "src/components/shared/KeyboardShortcuts.jsx",
  "src/components/shared/PageLoading.jsx",
  "src/components/trades/TradeModal.jsx",
  "src/styles/app.css",
];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing required desktop UX file: ${file}`);
}
const app = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
const sidebar = fs.readFileSync(path.join(root, "src/components/shared/Sidebar.jsx"), "utf8");
const modal = fs.readFileSync(path.join(root, "src/components/trades/TradeModal.jsx"), "utf8");
const css = fs.readFileSync(path.join(root, "src/styles/app.css"), "utf8");
const checks = [
  [app.includes("KeyboardShortcuts"), "keyboard shortcuts wired"],
  [app.includes("Workspace data refreshed."), "refresh toast wired"],
  [app.includes("Trade saved successfully."), "trade save toast wired"],
  [sidebar.includes("Workspace") && sidebar.includes("Analysis") && sidebar.includes("Tools"), "sidebar groups present"],
  [modal.includes('event.key === "Escape"'), "modal Escape handling present"],
  [modal.includes("Save Trade"), "modal save controls present"],
  [css.includes("td-toast") && css.includes("td-nav-group"), "desktop UX styles present"],
];
const failed = checks.filter(([ok]) => !ok);
if (failed.length) throw new Error(failed.map(([, name]) => `Failed: ${name}`).join("\n"));
console.log(`Desktop UX QA passed: ${required.length} required files present; ${checks.length} workflow checks passed.`);
