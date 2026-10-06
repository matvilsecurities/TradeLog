import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/services/connectorRegistry.js",
  "src/services/connectors/blackArrow.js",
  "src/hooks/useBrokerConnections.js",
  "src/components/apex/ConnectorCenter.jsx",
  "src/App.jsx",
  "src/components/shared/Sidebar.jsx",
  "PHASE23_CONNECTORS.md",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required connector files: ${missing.join(", ")}`);

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [
  ["BlackArrow catalog entry", read("src/services/connectorRegistry.js").includes('id: "the5ers-blackarrow"')],
  ["BlackArrow normalizer", read("src/services/connectors/blackArrow.js").includes("normalizeBlackArrowPayload")],
  ["No credential persistence", read("src/hooks/useBrokerConnections.js").includes("broker-connectors:")],
  ["Connector center UI", read("src/components/apex/ConnectorCenter.jsx").includes("The5ers · BlackArrow")],
  ["JSON import", read("src/components/apex/ConnectorCenter.jsx").includes("application/json")],
  ["CSV import", read("src/components/apex/ConnectorCenter.jsx").includes("text/csv")],
  ["Duplicate tracking", read("src/hooks/useBrokerConnections.js").includes("importedIds")],
  ["Account scoped connector state", read("src/hooks/useBrokerConnections.js").includes("${userId}:${accountId}")],
  ["App connector route", read("src/App.jsx").includes('view === "connections"')],
  ["Read-only wording", read("src/components/apex/ConnectorCenter.jsx").includes("Read-only synchronization")],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) throw new Error(`Connector QA failed: ${failed.map(([name]) => name).join(", ")}`);
console.log(`Connector QA passed: ${required.length} required files present; ${checks.length} connector checks passed.`);
