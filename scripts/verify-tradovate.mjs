import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/services/connectors/tradovate.js",
  "src/hooks/useTradovateConnector.js",
  "src/components/apex/ConnectorCenter.jsx",
  "netlify/functions/tradovate-oauth-callback.js",
  "PHASE24_TRADOVATE_CONNECTOR.md",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(", ")}`);

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const connector = read("src/services/connectors/tradovate.js");
const hook = read("src/hooks/useTradovateConnector.js");
const ui = read("src/components/apex/ConnectorCenter.jsx");
const fn = read("netlify/functions/tradovate-oauth-callback.js");
const app = read("src/App.jsx");
const envExample = fs.existsSync(path.join(root, ".env.example")) ? read(".env.example") : "";
const envLocal = fs.existsSync(path.join(root, ".env.local")) ? read(".env.local") : "";
const clientEnv = envExample || envLocal;

const checks = [
  ["OAuth authorization-code flow", connector.includes("response_type") && connector.includes("client_id") && fn.includes("authorization_code")],
  ["Server-side client secret", fn.includes("NT_CLIENT_SECRET") && !fn.includes("VITE_NT_CLIENT_SECRET")],
  ["No password field in UI", !ui.includes('type="password"') && ui.includes("authenticate directly on the NinjaTrader/Tradovate page")],
  ["Dynamic API hosts", hook.includes("apiHosts") && connector.includes("apiHosts") || hook.includes("apiHosts") && hook.includes("hostFromAuth")],
  ["Account discovery", hook.includes("account/list")],
  ["Orders and fills", hook.includes("order/list") && hook.includes("fill/list")],
  ["Positions and balances", hook.includes("position/list") && hook.includes("cashBalance/list")],
  ["Contract metadata", hook.includes("contract/list")],
  ["Explicit external-account mapping", hook.includes("selectedExternalAccountId") && ui.includes("Tradovate account to map")],
  ["Read-only connector", ui.includes("No external order placement") && !hook.includes("placeorder")],
  ["Tradovate import path", app.includes("apex-tradovate") && app.includes('meta.source === "Tradovate"')],
  ["FIFO trade normalization", connector.includes("while (remaining > 0") && connector.includes("open.shift")],
  ["MNQ/MGC point values", connector.includes("MNQ: 2") && connector.includes("MGC: 10")],
  ["Token not persisted to localStorage", !hook.includes("localStorage") && !hook.includes("sessionStorage")],
  ["Deployment secret guidance", fn.includes("NT_CLIENT_SECRET") && fn.includes("NT_OAUTH_REDIRECT_URI") && clientEnv.includes("VITE_NT_CLIENT_ID")],
];
const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) throw new Error(`Tradovate QA failed: ${failed.join("; ")}`);
console.log(`Tradovate QA passed: ${required.length} required files present; ${checks.length} connector checks passed.`);
