const n = (value, fallback = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const first = (obj, keys) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== "") return obj[key];
  }
  return null;
};

export function normalizeBlackArrowTrade(raw = {}, accountId) {
  const safeAccountId = String(accountId ?? "").trim();
  if (!safeAccountId || safeAccountId === "[object Object]") throw new Error("BlackArrow import requires an explicit TradeLog account.");
  const symbol = String(first(raw, ["symbol", "ticker", "instrument", "asset"]) || "").trim();
  const directionRaw = String(first(raw, ["direction", "side", "action"]) || "").toLowerCase();
  const direction = directionRaw.includes("sell") || directionRaw === "short" ? "Short" : "Long";
  const dateValue = first(raw, ["date", "tradeDate", "trade_date", "timestamp", "entryTime"]);
  const entry = n(first(raw, ["entry", "entryPrice", "entry_price", "openPrice"]));
  const exit = n(first(raw, ["exit", "exitPrice", "exit_price", "closePrice"]));
  const qty = n(first(raw, ["qty", "quantity", "contracts", "size"]), 1);
  const pnl = n(first(raw, ["pnl", "profit", "profitLoss", "profit_loss"]), 0);
  const externalId = String(first(raw, ["id", "tradeId", "trade_id", "executionId", "fillId"]) || "").trim();
  const timestamp = dateValue ? new Date(dateValue) : new Date();
  const iso = Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString();

  return {
    accountId: safeAccountId,
    externalTradeId: externalId || `${symbol}:${iso}:${direction}:${qty}:${entry ?? ""}:${exit ?? ""}`,
    connectorId: "the5ers-blackarrow",
    source: "BlackArrow",
    symbol,
    dir: direction,
    qty,
    entry,
    exit,
    pnl,
    date: iso.slice(0, 10),
    time: iso,
    exit_time: exit != null ? iso : "",
    status: exit != null ? "closed" : "open",
    raw,
  };
}

export function normalizeBlackArrowPayload(payload = {}, accountId) {
  const safeAccountId = String(accountId ?? "").trim();
  if (!safeAccountId || safeAccountId === "[object Object]") throw new Error("BlackArrow import requires an explicit TradeLog account.");
  const rows = Array.isArray(payload) ? payload : payload.trades || payload.fills || payload.data || [];
  return rows.map((row) => normalizeBlackArrowTrade(row, safeAccountId)).filter((trade) => trade.symbol || trade.externalTradeId);
}

export function getBlackArrowConnectionRequirements() {
  return {
    connectorId: "the5ers-blackarrow",
    required: ["accountId"],
    optional: ["webhookSecret", "bridgeUrl"],
    credentialStorage: "none",
    note: "TradeLog never stores a BlackArrow password or undocumented session token in browser storage.",
  };
}
