import fs from "node:fs";
import path from "node:path";

const required = [
  "src/components/trades/TradeLog.jsx",
  "src/components/trades/TradeModal.jsx",
  "src/components/trades/GuidedEntryModal.jsx",
  "src/components/trades/ChartPreview.jsx",
  "src/components/trades/tradingView.js",
  "src/components/trades/tradeUtils.js",
  "src/hooks/useTradeData.js",
  "src/supabase.js",
];

const missing = required.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error("Missing trade-system files:", missing.join(", "));
  process.exit(1);
}

const tradeUtils = fs.readFileSync("src/components/trades/tradeUtils.js", "utf8");
for (const token of ["calculateTradeNumbers", "validateTrade", "getPnl", "getHoldMinutes"]) {
  if (!tradeUtils.includes(`function ${token}`) && !tradeUtils.includes(`export function ${token}`)) {
    console.error(`Missing trade utility: ${token}`);
    process.exit(1);
  }
}

const modal = fs.readFileSync("src/components/trades/TradeModal.jsx", "utf8");
if (!modal.includes("validateTrade(f)")) {
  console.error("TradeModal validation layer is missing.");
  process.exit(1);
}

const hook = fs.readFileSync("src/hooks/useTradeData.js", "utf8");
if (hook.includes("editingTrade")) {
  console.error("useTradeData still depends on the removed editingTrade closure.");
  process.exit(1);
}

console.log(`Trade system static QA passed: ${required.length} required files present; shared calculations and validation detected.`);
