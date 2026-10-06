export const CONNECTOR_STATUS = {
  READY: "ready",
  CONNECTED: "connected",
  NEEDS_ACCESS: "needs_access",
  ERROR: "error",
  DISCONNECTED: "disconnected",
};

export const CONNECTOR_CATALOG = [
  {
    id: "the5ers-blackarrow",
    name: "The5ers · BlackArrow",
    firm: "The5ers",
    platform: "BlackArrow",
    mode: "read-only",
    priority: 1,
    status: CONNECTOR_STATUS.NEEDS_ACCESS,
    capabilities: ["trades", "fills", "account snapshot"],
    source: "https://the5ers.com/futures-faqs/what-trading-platform-can-i-use-with-the5ers-futures/",
    note: "The5ers currently supports BlackArrow for Futures. A public trader-facing BlackArrow API was not found in the official documentation, so TradeLog does not invent an undocumented login/API flow. The connector accepts normalized sync payloads from an approved API/webhook or local bridge.",
  },
  {
    id: "apex-tradovate",
    name: "Apex · Tradovate",
    firm: "Apex Trader Funding",
    platform: "Tradovate",
    mode: "read-only",
    priority: 2,
    status: CONNECTOR_STATUS.READY,
    capabilities: ["accounts", "fills", "orders", "positions", "balances"],
    source: "https://docs.ninjatrader.com/api/authentication",
    note: "OAuth-based, read-only connector using the official NinjaTrader/Tradovate Trade API. Credentials are never entered into TradeLog; the user authenticates on the NinjaTrader domain.",
  },
  {
    id: "apex-ninjatrader",
    name: "Apex · NinjaTrader",
    firm: "Apex Trader Funding",
    platform: "NinjaTrader",
    mode: "read-only",
    priority: 3,
    status: CONNECTOR_STATUS.READY,
    capabilities: ["accounts", "fills", "orders", "positions", "balances"],
    source: "https://docs.ninjatrader.com/api/oauth",
    note: "Read-only NinjaTrader Trade API connector. Uses OAuth, dynamic API hosts, external-account mapping and the existing durable TradeLog dedupe path.",
  },
];

export function getConnector(id) {
  return CONNECTOR_CATALOG.find((item) => item.id === id) || null;
}
